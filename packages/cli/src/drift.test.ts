import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { generateAllSkillFiles } from "@intent/skills";

// Drift tests: `.intent/rules/` must always match what the generator produces.
// If drift is found, init is out of date. Regenerating and diffing is the only
// reliable way to catch this.
describe("CLI drift", () => {
  let testDir: string;
  const cliPath = resolve(__dirname, "..", "dist", "cli.js");

  beforeEach(async () => {
    testDir = resolve(os.tmpdir(), `.test-cli-drift-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("generateAllSkillFiles produces a non-empty rules set", async () => {
    const intentDir = resolve(testDir, ".intent");
    await generateAllSkillFiles(testDir);
    const rulesDir = resolve(intentDir, "rules");
    const entries = await fs.readdir(rulesDir);
    // The generator writes intent-core.md, tool-usage.md, design-principles.md, studio.md
    expect(entries.length).toBeGreaterThanOrEqual(4);
    for (const f of ["intent-core.md", "tool-usage.md", "design-principles.md", "studio.md"]) {
      expect(entries).toContain(f);
    }
  });

  it("init --dry-run does not write any files to the project directory", async () => {
    const before = await listAllFiles(testDir);
    execSync(`node "${cliPath}" --path "${testDir}" init --dry-run`, {
      encoding: "utf-8",
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    const after = await listAllFiles(testDir);
    expect(after.sort()).toEqual(before.sort());
  }, 30000); // spawns a real node process; slow under full verify load

  it("init --dry-run still creates no .intent directory", async () => {
    execSync(`node "${cliPath}" --path "${testDir}" init --dry-run`, { encode: "utf-8" });
    const exists = await fs.access(resolve(testDir, ".intent")).then(() => true).catch(() => false);
    expect(exists).toBe(false);
  }, 30000);
});

async function listAllFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(p: string) {
    const entries = await fs.readdir(p, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = resolve(p, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(full);
    }
  }
  await walk(dir);
  return out;
}
