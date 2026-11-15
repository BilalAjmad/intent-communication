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
// ONLY protocol messages.

const CLI_JS = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");

let dir: string;

beforeEach(async () => {
  dir = resolve(tmpdir(), `intent mcp stdio ${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(dir, { recursive: true });
  await initCommand(dir); // creates .intent/ + merges agent MCP configs into the temp dir
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
});

describe("intent mcp (stdio)", () => {
  it("dist/cli.js exists; run pnpm --filter @intent/cli build first otherwise", () => {
    expect(existsSync(CLI_JS)).toBe(true);
  });

  it("lists exactly the six tools over stdio with the real MCP client", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CLI_JS, "mcp"],
      cwd: dir,
      stderr: "pipe",
    });
    const client = new Client({ name: "intent-test-client", version: "0.0.0" }, { capabilities: {} });
    try {
      await client.connect(transport);
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual(
        ["apply_patch", "ask_user", "get_feedback", "get_scene", "open_studio", "validate"],
      );
      // MCP requires every tool to carry an object inputSchema
      for (const tool of tools) {
        expect((tool.inputSchema as { type?: string }).type).toBe("object");
      }
    } finally {
      await client.close();
    }
  }, 30000);

  it("an ask_user roundtrip over stdio returns the plain-text card with the Don't know line", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [CLI_JS, "mcp"],
      cwd: dir,
      stderr: "pipe",
    });
    const client = new Client({ name: "intent-test-client", version: "0.0.0" }, { capabilities: {} });
    try {
      await client.connect(transport);
      const result = await client.callTool({
        name: "ask_user",
        arguments: {
          questionId: "q-test-1",
          kind: "choice",
          prompt: "Which look fits best?",
          options: [{ value: "minimal", label: "Minimal and calm" }],
        },
      });
      const text = (result.content as Array<{ type: string; text?: string }>)
        .map((c) => c.text ?? "")
        .join("\n");
      const parsed = JSON.parse(text) as { renderedText: string };
      expect(parsed.renderedText).toContain("Which look fits best?");
      expect(parsed.renderedText).toContain("0) Don't know, you choose");
      expect(parsed.renderedText).toContain("s) Skip");
    } finally {
      await client.close();
    }
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
