import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { mergeAgentMcpConfigs, defaultIntentCommand } from "./mcp-config";

// init must merge the "intent" server into .mcp.json (Claude Code, project
// scope) and .cursor/mcp.json (Cursor, project scope) WITHOUT touching other
// servers, idempotently, and --dry-run must write nothing.

let dir: string;
let command: { command: string; args: string[] };

beforeEach(async () => {
  dir = resolve(tmpdir(), `intent merge with spaces ${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(dir, { recursive: true });
  // Windows node path with spaces — the case the merge must not mangle.
  command = {
    command: "C:\\Program Files\\nodejs\\node.exe",
    args: [resolve(dir, "packages", "cli", "dist", "cli.js"), "mcp"],
  };
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
});

const claudePath = () => resolve(dir, ".mcp.json");
const cursorPath = () => resolve(dir, ".cursor", "mcp.json");

describe("mergeAgentMcpConfigs", () => {
  it("creates both files; node-with-spaces path stays one JSON array element", async () => {
    await mergeAgentMcpConfigs(dir, { dryRun: false, intentCommand: command });

    const claude = JSON.parse(await fs.readFile(claudePath(), "utf-8"));
    expect(claude.mcpServers.intent).toEqual(command);
    expect(claude.mcpServers.intent).not.toHaveProperty("type"); // Claude: no type => stdio (verified docs)
    expect(Array.isArray(claude.mcpServers.intent.args)).toBe(true);
    expect(claude.mcpServers.intent.args[0]).toBe(command.args[0]);

    const cursor = JSON.parse(await fs.readFile(cursorPath(), "utf-8"));
    expect(cursor.mcpServers.intent).toEqual({ type: "stdio", command: command.command, args: command.args });
    expect(cursor.mcpServers.intent.args[0]).toContain(" "); // spaces preserved, not split
  });

  it("keeps other servers and other top-level keys untouched; replaces only the intent entry", async () => {
    const other = { command: "npx", args: ["-y", "some-server"] };
    const staleIntent = { command: "node", args: ["old-path.js", "mcp"] };
    await fs.writeFile(
      claudePath(),
      JSON.stringify({ mcpServers: { other, intent: staleIntent }, unrelated: { keep: true } }, null, 2),
      "utf-8",
    );

    await mergeAgentMcpConfigs(dir, { dryRun: false, intentCommand: command });

    const claude = JSON.parse(await fs.readFile(claudePath(), "utf-8"));
    expect(claude.mcpServers.other).toEqual(other);
    expect(claude.unrelated).toEqual({ keep: true });
    expect(claude.mcpServers.intent).toEqual(command);
  });

  it("is idempotent: a second run changes nothing on disk", async () => {
    await mergeAgentMcpConfigs(dir, { dryRun: false, intentCommand: command });
    const claude1 = await fs.readFile(claudePath(), "utf-8");
    const cursor1 = await fs.readFile(cursorPath(), "utf-8");

    const reports = await mergeAgentMcpConfigs(dir, { dryRun: false, intentCommand: command });
    expect(reports.every((r) => !r.changed)).toBe(true);
    expect(await fs.readFile(claudePath(), "utf-8")).toBe(claude1);
    expect(await fs.readFile(cursorPath(), "utf-8")).toBe(cursor1);
  });

  it("--dry-run writes nothing, even when the file would change", async () => {
    const original = JSON.stringify({ mcpServers: { other: { command: "npx" } } }, null, 2);
    await fs.writeFile(claudePath(), original, "utf-8");

    const reports = await mergeAgentMcpConfigs(dir, { dryRun: true, intentCommand: command });
    expect(reports).toHaveLength(2);
    expect(reports[0].changed).toBe(true);
    expect(await fs.readFile(claudePath(), "utf-8")).toBe(original);
    await expect(fs.stat(cursorPath())).rejects.toThrow();
  });

  it("--dry-run on a missing project reports what it would write but writes nothing", async () => {
    const reports = await mergeAgentMcpConfigs(dir, { dryRun: true, intentCommand: command });
    expect(reports.every((r) => r.changed)).toBe(true);
    await expect(fs.stat(claudePath())).rejects.toThrow();
    await expect(fs.stat(cursorPath())).rejects.toThrow();
  });

  it("refuses to clobber a malformed .mcp.json; leaves the file byte-identical", async () => {
    await fs.writeFile(claudePath(), "{ not valid json", "utf-8");
    await expect(mergeAgentMcpConfigs(dir, { dryRun: false, intentCommand: command })).rejects.toThrow(
      /not valid JSON/,
    );
    expect(await fs.readFile(claudePath(), "utf-8")).toBe("{ not valid json");
  });

  it("refuses when mcpServers is not an object; leaves the file untouched", async () => {
    const raw = JSON.stringify({ mcpServers: "nope" });
    await fs.writeFile(claudePath(), raw, "utf-8");
    await expect(mergeAgentMcpConfigs(dir, { dryRun: false, intentCommand: command })).rejects.toThrow(
      /"mcpServers" must be/,
    );
    expect(await fs.readFile(claudePath(), "utf-8")).toBe(raw);
  });

  it("refuses when the top-level JSON is not an object", async () => {
    const raw = "[1, 2, 3]";
    await fs.writeFile(claudePath(), raw, "utf-8");
    await expect(mergeAgentMcpConfigs(dir, { dryRun: false, intentCommand: command })).rejects.toThrow(
      /top-level JSON object/,
    );
    expect(await fs.readFile(claudePath(), "utf-8")).toBe(raw);
  });

  it("defaultIntentCommand points at an absolute node with an absolute cli.js path and 'mcp'", () => {
    const cmd = defaultIntentCommand();
    expect(cmd.command).toBe(process.execPath);
    expect(cmd.args).toHaveLength(2);
    expect(cmd.args[0].toLowerCase().endsWith("cli.js")).toBe(true);
    expect(cmd.args[1]).toBe("mcp");
  });
});
