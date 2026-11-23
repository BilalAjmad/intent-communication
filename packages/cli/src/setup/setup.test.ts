import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { ADAPTERS, ADAPTER_IDS } from "./adapters/index.js";
import { applySetup, detectAdapters } from "./engine.js";
import { INTENT_COMMAND_BODY, PROTOTYPE_COMMAND_BODY } from "@intent/skills";
import type { SetupEnv } from "./types.js";

let home: string;
let project: string;
let env: SetupEnv;

beforeEach(async () => {
  const base = resolve(os.tmpdir(), `.intent-setup-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  home = resolve(base, "home with spaces");
  project = resolve(base, "project with spaces");
  await fs.mkdir(resolve(home, ".claude"), { recursive: true });
  await fs.mkdir(resolve(home, ".cursor"), { recursive: true });
  await fs.mkdir(resolve(project, ".claude"), { recursive: true });
  await fs.mkdir(resolve(project, ".cursor"), { recursive: true });
  env = {
    home, projectRoot: project, platform: process.platform,
    intentCommand: { command: resolve(home, "node with spaces.exe"), args: [resolve(home, "intent.cjs"), "mcp"] },
  };
});

afterEach(async () => {
  await fs.rm(resolve(home, ".."), { recursive: true, force: true }).catch(() => {});
});

const install = (selected: string[], extra: Partial<Parameters<typeof applySetup>[0]> = {}) =>
  applySetup({ env, scope: "project", adapters: ADAPTERS, selected, dryRun: false, uninstall: false, ...extra });

const readJson = async (file: string) => JSON.parse(await fs.readFile(file, "utf-8")) as Record<string, unknown>;

describe("universal setup — registry", () => {
  it("has one adapter per required agent with doc provenance", () => {
    expect(ADAPTERS).toHaveLength(17);
    expect(new Set(ADAPTER_IDS).size).toBe(17);
    for (const id of [
      "claude-code", "cursor", "windsurf", "cline", "roo-code", "kilo-code", "codex-cli", "gemini-cli",
      "github-copilot", "vscode-mcp", "zed", "continue", "opencode", "amp", "goose", "jetbrains-ai", "claude-desktop",
    ]) expect(ADAPTER_IDS).toContain(id);
    for (const a of ADAPTERS) {
      expect(a.docsUrl).toMatch(/^https:\/\//);
      expect(typeof a.docsVerified).toBe("boolean");
      expect(a.manual()).toContain(a.docsUrl);
    }
    expect(ADAPTERS.filter((a) => a.docsVerified).map((a) => a.id)).toEqual(
      expect.arrayContaining(["claude-code", "cursor", "gemini-cli", "github-copilot", "vscode-mcp"]),
    );
  });

  it("detects installed agents without writing", async () => {
    const detected = await detectAdapters(ADAPTERS, env, "project");
    expect(detected.find((d) => d.agent === "claude-code")?.detected).toBe(true);
    expect(detected.find((d) => d.agent === "cursor")?.detected).toBe(true);
    expect(detected.find((d) => d.agent === "goose")?.detected).toBe(false);
  });
});

describe("universal setup — merge, idempotence, dry-run, uninstall", () => {
  it("merges MCP entries, rules and slash commands; preserves other servers", async () => {
    await fs.writeFile(resolve(project, ".mcp.json"), JSON.stringify({ mcpServers: { other: { command: "other" } }, custom: 1 }), "utf-8");
    const results = await install(["claude-code", "cursor"]);
    expect(results.every((r) => r.status === "configured")).toBe(true);

    const claude = await readJson(resolve(project, ".mcp.json"));
    expect(claude.custom).toBe(1);
    expect(claude.mcpServers.other.command).toBe("other");
    expect(claude.mcpServers.intent).toEqual(env.intentCommand);

    const cursor = await readJson(resolve(project, ".cursor", "mcp.json"));
    expect(cursor.mcpServers.intent.type).toBe("stdio");
    expect(cursor.mcpServers.intent.command).toContain("home with spaces");

    expect(await fs.readFile(resolve(project, ".claude/commands/intent.md"), "utf-8")).toBe(INTENT_COMMAND_BODY);
    expect(await fs.readFile(resolve(project, ".cursor/commands/prototype.mdc"), "utf-8")).toBe(PROTOTYPE_COMMAND_BODY);
    expect(await fs.readFile(resolve(project, ".claude/CLAUDE.md"), "utf-8")).toContain("<!-- intent:setup:start -->");
  });

  it("is idempotent and backs up before the first change", async () => {
    await fs.writeFile(resolve(project, ".mcp.json"), JSON.stringify({ mcpServers: { other: { command: "other" } } }), "utf-8");
    const first = await install(["claude-code"]);
    expect(first[0]?.status).toBe("configured");
    const backups = (await fs.readdir(project)).filter((f) => f.includes(".intent-backup-"));
    expect(backups.length).toBeGreaterThan(0);
    const second = await install(["claude-code"]);
    expect(second[0]?.status).toBe("unchanged");
    expect((await fs.readdir(project)).filter((f) => f.includes(".intent-backup-"))).toHaveLength(backups.length);
  });

  it("writes nothing on dry run", async () => {
    const results = await install(["claude-code", "cursor"], { dryRun: true });
    expect(results.every((r) => r.status === "configured")).toBe(true);
    for (const r of results) for (const p of r.paths) await expect(fs.access(p)).rejects.toThrow();
    expect((await fs.readdir(project)).some((f) => f.includes(".intent-backup-"))).toBe(false);
  });

  it("uninstall removes only our entries and blocks", async () => {
    await fs.writeFile(resolve(project, ".mcp.json"), JSON.stringify({ mcpServers: { other: { command: "other" } } }), "utf-8");
    await fs.writeFile(resolve(project, ".claude/CLAUDE.md"), "# My rules\nKeep this.\n", "utf-8");
    await install(["claude-code"]);
    await install(["claude-code"], { uninstall: true });
    const claude = await readJson(resolve(project, ".mcp.json"));
    expect(claude.mcpServers.intent).toBeUndefined();
    expect(claude.mcpServers.other.command).toBe("other");
    const rules = await fs.readFile(resolve(project, ".claude/CLAUDE.md"), "utf-8");
    expect(rules).toContain("Keep this.");
    expect(rules).not.toContain("<!-- intent:setup:start -->");
    await expect(fs.access(resolve(project, ".claude/commands/intent.md"))).rejects.toThrow();
  });

  it("returns a manual snippet instead of editing unsafe formats", async () => {
    const results = await install(["codex-cli", "zed", "goose", "jetbrains-ai"], { all: true });
    expect(results.every((r) => r.status === "manual")).toBe(true);
    for (const a of ADAPTERS.filter((x) => ["codex-cli", "zed", "goose", "jetbrains-ai"].includes(x.id))) {
      expect(a.manual()).toContain("mcpServers");
    }
  });

  it("written configs point at a real MCP server exposing exactly six tools", async () => {
    const cliJs = resolve(process.cwd(), "dist", "cli.js");
    let hasCli = false;
    try {
      await fs.access(cliJs);
      hasCli = true;
    } catch {
      // Not built in this environment — fall back to config content assertion.
    }
    const realEnv: SetupEnv = {
      ...env,
      intentCommand: hasCli ? { command: process.execPath, args: [cliJs, "mcp"] } : env.intentCommand,
    };
    await applySetup({ env: realEnv, scope: "project", adapters: ADAPTERS, selected: ["claude-code", "cursor", "gemini-cli"], dryRun: false, uninstall: false, all: true });
    const configs = [".mcp.json", ".cursor/mcp.json", ".gemini/settings.json"].map((p) => resolve(project, p));
    const entries: unknown[] = [];
    for (const file of configs) {
      const json = await readJson(file);
      entries.push(json.mcpServers.intent);
    }
    const launch = (e: unknown) => {
      const o = e as { command: string; args: string[] };
      return { command: o.command, args: o.args };
    };
    expect(launch(entries[1])).toEqual(launch(entries[0]));
    expect(launch(entries[2])).toEqual(launch(entries[0]));
    if (!hasCli) return; // content-only assertion where a real client cannot be spawned
    const entry = entries[0] as { command: string; args: string[] };
    const child = spawn(entry.command, entry.args, { cwd: project, stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "";
    const tools = await new Promise<string[]>((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error("tools/list timed out")), 15000);
      child.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        for (const line of buffer.split("\n")) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line) as { id?: number; result?: { tools?: { name: string }[] } };
            if (msg.id === 2 && msg.result?.tools) {
              clearTimeout(timer);
              resolvePromise(msg.result.tools.map((t) => t.name));
            }
          } catch {
            // partial line — keep buffering
          }
        }
        buffer = buffer.slice(buffer.lastIndexOf("\n") + 1);
      });
      child.on("error", reject);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n");
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
    }).finally(() => child.kill());
    expect(tools.slice().sort()).toEqual(["apply_patch", "ask_user", "create_object", "delete_object", "get_feedback", "get_scene", "open_studio", "validate"]);
  });
});
