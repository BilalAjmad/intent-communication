import { describe, it, expect } from "vitest";
import { generateAllSkillFiles } from "@intent/skills";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";

// Budget test (trd 20): the packed skills output must stay within size limits.
// These limits are the contract that the generated rules remain useful to an
// implementing agent: large enough to be useful, small enough to fit in context.
describe("CLI budget", () => {
  it("packed rules fit within 64 KB total and 20 KB per-file", async () => {
    const testDir = resolve(os.tmpdir(), `.test-cli-budget-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

    try {
      await generateAllSkillFiles(testDir);
      const rulesDir = resolve(testDir, ".intent", "rules");
      const entries = await fs.readdir(rulesDir);

      let total = 0;
      for (const file of entries) {
        const content = await fs.readFile(resolve(rulesDir, file), "utf-8");
        expect(content.length, `file ${file} exceeds 20 KB`).toBeLessThanOrEqual(20 * 1024);
        total += content.length;
      }

      expect(total, "total rules bytes exceed 64 KB").toBeLessThanOrEqual(64 * 1024);
    } finally {
      await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("packed rules are valid markdown (LF, no NULs)", async () => {
    const testDir = resolve(os.tmpdir(), `.test-cli-budget-md-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

    try {
      await generateAllSkillFiles(testDir);
      const rulesDir = resolve(testDir, ".intent", "rules");
      const entries = await fs.readdir(rulesDir);

      for (const file of entries) {
        const content = await fs.readFile(resolve(rulesDir, file), "utf-8");
        // No NUL byte or C0 control characters except TAB/LF/CR
        let hasControl = false;
        for (let i = 0; i < content.length; i++) {
          const code = content.charCodeAt(i);
          if (code !== 9 && code !== 10 && code !== 13 && code < 32) {
            hasControl = true;
            break;
          }
        }
        expect(hasControl, `file ${file} contains control characters`).toBe(false);
        expect(content.length).toBeGreaterThan(0);
      }
    } finally {
      await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
