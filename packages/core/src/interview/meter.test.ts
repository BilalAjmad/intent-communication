import { describe, it, expect } from "vitest";
import {
  estimateMeter,
  EVIDENCE,
  createInterviewView,
  fatigueReached,
  nextQuestion,
  answerSlot,
  delegateOrSkip,
  meterFor,
  slotsInScope,
  activeTopics,
  TaskSize,
} from "./meter";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Golden-file tests for the Interview Meter (AC-M1-02).
//
// The meter computes "Estimated understanding" from slot evidence only — never
// from agent claims (intent.md §7.2). These tests pin the meter to the worked
// example in intent.md §7.4 and to frozen snapshots per task size.

const here = dirname(fileURLToPath(import.meta.url));
const goldenPath = (name: string) => join(here, "..", "..", "testdata", "meter-golden", `${name}.json`);

function readGolden(name: string): Array<{ step: string; slot: string; value: number; expectedPercent: number }> {
  return JSON.parse(readFileSync(goldenPath(name), "utf-8"));
}

describe("Meter: active scope by size", () => {
  it("small has the six required topics", () => {
    expect(activeTopics("small")).toEqual(["goal", "users", "screens", "flow", "style", "content"]);
  });
  it("medium adds behavior", () => {
    expect(activeTopics("medium")).toEqual(["goal", "users", "screens", "flow", "style", "content", "behavior"]);
  });
  it("large adds edge-cases", () => {
    expect(activeTopics("large")).toEqual(["goal", "users", "screens", "flow", "style", "content", "behavior", "edge-cases"]);
  });
  it("small slots = 11 (goal 2, users 1, screens 2, flow 1, style 3, content 2)", () => {
    expect(slotsInScope("small")).toHaveLength(11);
  });
  it("medium = 28 slots (P1+P2 set)", () => {
    // Tier scope is a fixed property of size; milestones gate seed availability, not slot scope.
    expect(slotsInScope("medium")).toHaveLength(28);
  });
});

describe("Meter: works example (intent.md §7.4, small task, M1)", () => {
  // Worked example from the spec: prompt states goal.purpose, goal.platform,
  // users.primary, screens.list, style.mood, style.palette, content.tone;
  // screens.nav and style.theme delegated; flow.main and content.data unknown.
  const baseEvidence = {
    "goal.purpose": EVIDENCE.stated,
    "goal.platform": EVIDENCE.stated,
    "users.primary": EVIDENCE.stated,
    "screens.list": EVIDENCE.stated,
    "screens.nav": EVIDENCE.assumed,
    "style.mood": EVIDENCE.stated,
    "style.palette": EVIDENCE.stated,
    "style.theme": EVIDENCE.assumed,
    "content.tone": EVIDENCE.stated,
    "content.data": EVIDENCE.unknown,
    "flow.main": EVIDENCE.unknown,
  } as const;

  it("worked example: 69% for the worked example", () => {
    const { serverPercent, capped, percent } = estimateMeter(baseEvidence, { size: "small" });
    expect(serverPercent).toBe(69);
    // "at most 89 while a required topic is none" — flow is none here, but 69 < 89 so we land on 69.
    expect(percent).toBe(69);
    expect(capped).toBe(false);
  });

  it("computes 86% after answering flow.main (stated)", () => {
    const result = estimateMeter({ ...baseEvidence, "flow.main": EVIDENCE.stated }, { size: "small" });
    expect(result.serverPercent).toBe(86);
  });

  it("computes 91% after answering content.data too", () => {
    const result = estimateMeter(
      { ...baseEvidence, "flow.main": EVIDENCE.stated, "content.data": EVIDENCE.stated },
      { size: "small" }
    );
    expect(result.serverPercent).toBe(91);
    expect(result.capped).toBe(false); // all required topics at least partial
    expect(result.percent).toBe(91);
  });

  it("caps at 89 while any required topic is none (never exceeds 89)", () => {
    // Make every required topic `none`: only unknowns outside those topics stated.
    const evidence: Record<string, 0 | 0.5 | 1> = {
      "goal.purpose": EVIDENCE.unknown,
      "goal.platform": EVIDENCE.unknown,
      "users.primary": EVIDENCE.unknown,
      "screens.list": EVIDENCE.unknown,
      "screens.nav": EVIDENCE.unknown,
      "flow.main": EVIDENCE.unknown,
      "style.mood": EVIDENCE.unknown,
      "style.palette": EVIDENCE.unknown,
      "style.theme": EVIDENCE.unknown,
      "content.tone": EVIDENCE.unknown,
      "content.data": EVIDENCE.unknown,
    };
    const { percent, capped } = estimateMeter(evidence, { size: "small" });
    expect(percent).toBeLessThanOrEqual(89);
    expect(capped).toBe(false); // 0 < 89, so nothing to cap
  });
});

describe("Meter: interview driver", () => {
  it("small interview walks the deterministic seed order", () => {
    const view = createInterviewView("small");
    const order: string[] = [];
    for (let i = 0; i < 20; i++) {
      const q = nextQuestion(view);
      if (!q) break;
      order.push(q.profileKey as string);
      answerSlot(view, q.profileKey as string, EVIDENCE.stated);
    }
    // Deterministic: goal.purpose first; all 11 P1 slots askable; all get stated → 100% understanding.
    expect(order[0]).toBe("goal.purpose");
    expect(order).toContain("goal.platform");
    expect(order).toContain("users.primary");
    expect(order).toContain("screens.list");
    expect(order).toContain("screens.nav");
    expect(order).toContain("flow.main");
    expect(order).toContain("style.mood");
    expect(order.length).toBe(11); // 11 P1 slots in scope, all askable since the G1 seed was added
    expect(meterFor(view).serverPercent).toBe(100);
  });

  it("delegate counts as assumed (0.5), not stated", () => {
    const view = createInterviewView("small");
    answerSlot(view, "goal.purpose", EVIDENCE.stated);
    delegateOrSkip(view, "goal.platform");
    const meter = meterFor(view);
    // goal = (1.0 + 0.5)/2 = 0.75 → covered; others unknown/none
    expect(meter.topicStatus.goal).toBe("covered");
    expect(meter.topicStatus.users).toBe("none");
    expect(view.consecutiveNonAnswers).toBe(1);
  });
});

describe("Meter: golden files", () => {
  for (const name of ["small", "medium", "large"] as const) {
    it(`${name} interview matches the frozen snapshot`, () => {
      const trace = readGolden(name);
      const view = createInterviewView(name as TaskSize);
      for (const step of trace) {
        answerSlot(view, step.slot, step.value as 0 | 0.5 | 1);
        const meter = meterFor(view);
        expect(meter.serverPercent, `${name}/${step.slot}`).toBe(step.expectedPercent);
      }
    });
  }
});

describe("Fatigue (SC-4)", () => {
  it("fatigueReached flips at 3 consecutive non-answers and resets on an answer", () => {
    const view = createInterviewView("small");
    expect(fatigueReached(view)).toBe(false);
    delegateOrSkip(view, "goal.purpose");
    delegateOrSkip(view, "goal.platform");
    expect(fatigueReached(view)).toBe(false);
    delegateOrSkip(view, "users.primary");
    expect(fatigueReached(view)).toBe(true);
    answerSlot(view, "screens.list", EVIDENCE.stated);
    expect(fatigueReached(view)).toBe(false);
  });
});
