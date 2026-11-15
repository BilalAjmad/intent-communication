import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ensureAgentsIntentBlock, INTENT_AGENTS_BLOCK } from "./agents-block";

let dir: string;

beforeEach(async () => {
  dir = resolve(tmpdir(), `intent-agents-block ${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(dir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
});

const agentsPath = () => resolve(dir, "AGENTS.md");

describe("ensureAgentsIntentBlock", () => {
  it("creates AGENTS.md containing only the block when missing", async () => {
    const result = await ensureAgentsIntentBlock(dir, { dryRun: false });
    expect(result.action).toBe("created");
    const content = await fs.readFile(agentsPath(), "utf-8");
    expect(content).toContain("<!-- intent:start -->");
    expect(content).toContain("<!-- intent:end -->");
    expect(content).toContain("ask_user");
  });

  it("appends the block to an existing AGENTS.md without touching user content", async () => {
    const user = "# My project\n\nSome rules I wrote myself.\n";
    await fs.writeFile(agentsPath(), user, "utf-8");
    const result = await ensureAgentsIntentBlock(dir, { dryRun: false });
    expect(result.action).toBe("appended");
    const content = await fs.readFile(agentsPath(), "utf-8");
    expect(content.startsWith(user)).toBe(true);
    expect(content).toContain("<!-- intent:start -->");
  });

  it("is idempotent: running twice produces no changes the second time", async () => {
    const first = await ensureAgentsIntentBlock(dir, { dryRun: false });
    const once = await fs.readFile(agentsPath(), "utf-8");
    const second = await ensureAgentsIntentBlock(dir, { dryRun: false });
    const twice = await fs.readFile(agentsPath(), "utf-8");
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(second.action).toBe("unchanged");
    expect(twice).toBe(once);
  });

  it("replaces a stale block in place and keeps surrounding content", async () => {
    const stale = "<!-- intent:start -->\n\n## Intent\n\nOLD STALE TEXT\n\n<!-- intent:end -->\n";
    const user = "# Header\n\n" + stale + "\n## Footer\n";
    await fs.writeFile(agentsPath(), user, "utf-8");
    const result = await ensureAgentsIntentBlock(dir, { dryRun: false });
    expect(result.action).toBe("replaced");
    const content = await fs.readFile(agentsPath(), "utf-8");
    expect(content).toContain("# Header");
    expect(content).toContain("## Footer");
    expect(content).not.toContain("OLD STALE TEXT");
    expect(content).toContain("ask_user");
  });

  it("--dry-run writes nothing for a missing file", async () => {
    const result = await ensureAgentsIntentBlock(dir, { dryRun: true });
    expect(result.action).toBe("created");
    expect(result.changed).toBe(true);
    await expect(fs.stat(agentsPath())).rejects.toThrow();
  });

  it("--dry-run writes nothing for an append", async () => {
    const user = "# Keep me\n";
    await fs.writeFile(agentsPath(), user, "utf-8");
    const result = await ensureAgentsIntentBlock(dir, { dryRun: true });
    expect(result.action).toBe("appended");
    expect(await fs.readFile(agentsPath(), "utf-8")).toBe(user);
  });

  it("block contains the pointer to .intent/rules and the one-question-at-a-time rule", () => {
    expect(INTENT_AGENTS_BLOCK).toContain(".intent/rules/intent-core.md");
    expect(INTENT_AGENTS_BLOCK).toContain(".intent/rules/tool-usage.md");
    expect(INTENT_AGENTS_BLOCK).toMatch(/one question at a time/i);
  });
});
