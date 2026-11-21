import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createMCPContext, handleMCPRequest } from "./index";

let testDir: string;
let context: ReturnType<typeof createMCPContext>;

beforeEach(async () => {
  testDir = resolve(os.tmpdir(), `.test-softcap-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(resolve(testDir, ".intent", "scenes"), { recursive: true });
  context = createMCPContext(testDir);
});
afterEach(async () => { await fs.rm(testDir, { recursive: true, force: true }); });

const ask = (n: number) => ({
  questionId: `q_${String(n).padStart(26, "0")}`,
  kind: "choice",
  prompt: `Question ${n}?`,
  options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
  questionNumber: n,
  estimatedTotal: 20,
  requiredTopics: ["goal", "users", "screens"],
});

describe("soft cap is a hint, not a hard stop (trd 10.2 rule 4 / SC-2)", () => {
  it("returns honest over=true + hint past 20, and still accepts question 21+", async () => {
    let last: Awaited<ReturnType<typeof handleMCPRequest>>;
    for (let i = 1; i <= 22; i++) {
      last = await handleMCPRequest("ask_user", ask(i), context);
      expect(last.budget.asked).toBe(i);
      expect(last.budget.softCap).toBe(20);
      if (i <= 20) {
        expect(last.budget.over).toBe(false);
        expect(last.hint).toBeUndefined();
      } else {
        expect(last.budget.over).toBe(true);
        expect(String(last.hint)).toContain("no hard limit");
      }
    }
    expect(last.budget.asked).toBe(22);
    // Meter is honest — no fabricated 100%.
    expect(last.meterApplied.percent).toBeLessThanOrEqual(100);
  });
});
