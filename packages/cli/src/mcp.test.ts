import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { initCommand } from "./index";

// `intent mcp` (trd 14.3): a real MCP client (@modelcontextprotocol/sdk)
// spawns the built CLI over stdio and lists the six tools. stdout must carry
// ONLY protocol messages. Tool responses use the trd 10.1 envelope:
//   { ok: true, data, warnings? } | { ok: false, error: { code, message, details?, hint? } }
// with `structuredContent` and the text block carrying the same object,
// and the MCP `isError` flag set on failure.

const CLI_JS = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

interface Envelope<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown; hint?: string };
  warnings?: unknown[];
}

function fixtureScene() {
  return {
    version: 1,
    revision: 0,
    createdAt: "2026-11-15T00:00:00.000Z",
    updatedAt: "2026-11-15T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN,
        type: "screen",
        parentId: null,
        children: [TEXT],
        props: { title: "M", width: 390, height: 844 },
        style: {},
        meta: {},
      },
    },
    objects: {
      [TEXT]: { id: TEXT, type: "text", parentId: SCREEN, children: [], props: { content: "Hi" }, style: {}, meta: {} },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Env", tags: [] },
  };
}

let dir: string;

beforeEach(async () => {
  dir = resolve(tmpdir(), `intent mcp stdio ${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(dir, { recursive: true });
  await initCommand(dir); // .intent/ + agent MCP configs in the temp dir
  await fs.writeFile(resolve(dir, ".intent", "scenes", "default.json"), JSON.stringify(fixtureScene()), "utf-8");
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
});

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [CLI_JS, "mcp"],
    cwd: dir,
    stderr: "pipe",
  });
  const client = new Client({ name: "intent-test-client", version: "0.0.0" }, { capabilities: {} });
  try {
    await client.connect(transport);
    return await fn(client);
  } finally {
    await client.close();
  }
}

function envelopeOf(result: unknown): { envelope: Envelope; isError: boolean; contentText: string } {
  const r = result as {
    structuredContent?: Envelope;
    isError?: boolean;
    content?: Array<{ type: string; text?: string }>;
  };
  const contentText = (r.content ?? []).map((c) => c.text ?? "").join("\n");
  const parsed = JSON.parse(contentText) as Envelope;
  return { envelope: parsed, isError: r.isError === true, contentText };
}

describe("intent mcp (stdio)", () => {
  it("dist/cli.js exists; run pnpm --filter @intent/cli build first otherwise", () => {
    expect(existsSync(CLI_JS)).toBe(true);
  });

  it("lists exactly the eight tools over stdio with the real MCP client", async () => {
    await withClient(async (client) => {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual(
        ["apply_patch", "ask_user", "create_object", "delete_object", "get_feedback", "get_scene", "open_studio", "validate"],
      );
      for (const tool of tools) {
        expect((tool.inputSchema as { type?: string }).type).toBe("object");
      }
    });
  }, 30000);

  it("a successful tool call returns the trd 10.1 envelope: { ok: true, data } in text AND structuredContent", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "ask_user",
        arguments: {
          questionId: "q-env-1",
          kind: "choice",
          prompt: "Which look?",
          options: [{ value: "minimal", label: "Minimal" }],
        },
      });
      const { envelope, isError, contentText } = envelopeOf(result);
      expect(isError).toBe(false);
      expect(envelope.ok).toBe(true);
      const data = envelope.data as { questionId: string; renderedText: string };
      expect(data.questionId).toBe("q-env-1");
      expect(data.renderedText).toContain("Which look?");
      expect(data.renderedText).toContain("0) Don't know, you choose");
      // text block and structuredContent carry the SAME object
      const structured = (result as { structuredContent?: Envelope }).structuredContent;
      expect(structured).toEqual(envelope);
      expect(contentText).toBe(JSON.stringify(envelope));
    });
  }, 30000);

  it("invalid tool input returns { ok: false, error: { code: E_SCHEMA, details: issues[] } } with isError: true", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "ask_user",
        arguments: { questionId: "q-env-2", kind: "choice" }, // missing prompt + options omitted is fine
      });
      const { envelope, isError } = envelopeOf(result);
      expect(isError).toBe(true);
      expect(envelope.ok).toBe(false);
      expect(envelope.error?.code).toBe("E_SCHEMA");
      const details = envelope.error?.details as { issues?: Array<{ path?: (string | number)[] }> } | undefined;
      expect(Array.isArray(details?.issues)).toBe(true);
      expect(details?.issues?.some((i) => (i.path ?? []).join(".").includes("prompt"))).toBe(true);
      const structured = (result as { structuredContent?: Envelope }).structuredContent;
      expect(structured).toEqual(envelope);
    });
  }, 30000);

  it("apply_patch with a stale baseRevision fails through the envelope (E_CONFLICT) with isError: true", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "apply_patch",
        arguments: {
          patch: {
            id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            sceneId: "default",
            baseRevision: 999,
            objectId: TEXT,
            op: "set",
            path: "props.content",
            value: "New",
            createdAt: "2026-11-15T00:00:00.000Z",
          },
        },
      });
      const { envelope, isError } = envelopeOf(result);
      expect(isError).toBe(true);
      expect(envelope.ok).toBe(false);
      expect(envelope.error?.code).toBe("E_CONFLICT");
      const structured = (result as { structuredContent?: Envelope }).structuredContent;
      expect(structured).toEqual(envelope);
    });
  }, 30000);

  it("validate verdict stays data, not an error: { ok: true, data: { valid: false } }, isError unset", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "validate",
        arguments: { type: "scene", data: { version: 2 } },
      });
      const { envelope, isError } = envelopeOf(result);
      expect(isError).toBe(false);
      expect(envelope.ok).toBe(true);
      expect((envelope.data as { valid: boolean }).valid).toBe(false);
    });
  }, 30000);

  it("stdout carries only protocol messages (every line is JSON-RPC 2.0)", async () => {
    const child = spawn(process.execPath, [CLI_JS, "mcp"], { cwd: dir, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    const send = (obj: unknown) => child.stdin.write(JSON.stringify(obj) + "\n");
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "probe", version: "0.0.0" } } });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    await new Promise((r) => setTimeout(r, 1500));
    child.stdin.end();

    await new Promise<void>((done, fail) => {
      child.on("exit", () => done());
      child.on("error", fail);
    });

    const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      const msg = JSON.parse(line) as { jsonrpc?: string; result?: unknown; error?: unknown };
      expect(msg.jsonrpc).toBe("2.0");
      expect(msg.result === undefined ? msg.error !== undefined : true).toBe(true);
    }
    expect(stderr).toBe("");
  }, 30000);
});
