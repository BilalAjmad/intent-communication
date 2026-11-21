import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createMCPContext, handleMCPRequest } from "./index";

// intent.md M1 "Interview simulator" — a scripted agent drives a full
// interview against the real server (the real ask_user handler + real storage)
// and checks the question counts, the meter path and the final summary.
// Everything here is deterministic: no agent, no network, no clock dependence.

const SCENE_ID = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";

let testDir: string;
let context: ReturnType<typeof createMCPContext>;

beforeEach(async () => {
  testDir = resolve(os.tmpdir(), `.test-interview-sim-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(testDir, ".intent", "scenes"), { recursive: true });
  const scene = {
    version: 1, revision: 1,
    createdAt: "2026-11-18T00:00:00.000Z", updatedAt: "2026-11-18T00:00:00.000Z",
    screens: {}, objects: {}, screenOrder: [],
    metadata: { name: "Sim", tags: [] },
  };
  await fs.writeFile(resolve(testDir, ".intent", "scenes", `${SCENE_ID}.json`), JSON.stringify(scene), "utf-8");
  context = createMCPContext(testDir);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

const readState = async () => {
  const raw = await fs.readFile(resolve(testDir, ".intent", "interview", "state.json"), "utf-8");
  return JSON.parse(raw) as {
    status: string; currentQuestionIndex: number; meter: number;
    answers: { via: string }[]; pendingQuestion: { kind: string } | null;
  };
};
const readMetrics = async () => {
  const raw = await fs.readFile(resolve(testDir, ".intent", "metrics.json"), "utf-8");
  return JSON.parse(raw) as {
    sessions: { asked: number; answered: number; delegated?: number; summaryChoices: string[]; finalPercent: number | null; abandoned: boolean }[];
  };
};

const ask = (input: Record<string, unknown>) =>
  handleMCPRequest("ask_user", input, context) as Promise<Record<string, unknown>>;

describe("Interview simulator (intent.md M1: small interview, real server)", () => {
  it("drives start → questions → summary → exactly-right to a complete state", async () => {
    await ask({
      kind: "start", questionId: "s1", prompt: "What are we building?", topic: "goal",
      options: [{ value: "app", label: "An app" }, { value: "site", label: "A site" }],
      questionNumber: 1, estimatedTotal: 4, requiredTopics: ["goal"], meter: { percent: 25, topics: { goal: "partial" } },
    });
    let state = await readState();
    expect(state.pendingQuestion?.kind).toBe("start");

    await ask({
      kind: "choice", questionId: "c1", prompt: "Which tone?", topic: "content",
      options: [{ value: "playful", label: "Playful" }, { value: "formal", label: "Formal" }],
      questionNumber: 2, estimatedTotal: 4,
      previousAnswer: { questionId: "s1", answer: { choiceId: "app" } },
      meter: { percent: 50, topics: { goal: "covered", content: "covered" } },
    });
    state = await readState();
    expect(state.currentQuestionIndex).toBe(1);
    expect(state.answers).toHaveLength(1);

    await ask({
      kind: "summary", questionId: "sum1", prompt: "Is this right?", questionNumber: 3, estimatedTotal: 4,
      summary: { paragraph: "You want a playful app.", items: [{ topic: "goal", text: "An app" }], delegated: [] },
      previousAnswer: { questionId: "c1", answer: { choiceId: "playful" } },
      meter: { percent: 88, topics: { goal: "covered", content: "covered" } },
    });
    state = await readState();
    expect(state.status).toBe("in_progress");
    expect(state.pendingQuestion?.kind).toBe("summary");

    // The user approves in chat; the agent records the approval as the
    // previousAnswer on its next call. Interview completes and the metrics
    // session closes with the final capped meter.
    await ask({
      kind: "confirm", questionId: "done1", prompt: "Understood — building now.",
      questionNumber: 4,
      previousAnswer: { questionId: "sum1", answer: { summaryChoice: "exactly-right" } },
      meter: { percent: 91 },
    });
    state = await readState();
    expect(state.status).toBe("complete");
    expect(state.answers).toHaveLength(3);

    // Final master order 2026-11-21: /intent ends by saving brief.json, and the
    // brief is built only from recorded answers (no invented colors or names).
    const stateWithBrief = (await context.storage.readInterviewState())!;
    expect(stateWithBrief.briefId).toBeTruthy();
    const brief = await context.storage.readBrief(stateWithBrief.briefId!);
    expect(brief).toMatchObject({ approvalStatus: "approved", approvedBy: "user" });
    expect(brief?.summary).toContain("playful app");
    expect(brief?.goals).toContain("An app");
    expect(brief?.designDirection.palette).toEqual([]);

    const metrics = await readMetrics();
    const session = metrics.sessions[metrics.sessions.length - 1];
    expect(session).toMatchObject({ asked: 4, answered: 3, abandoned: false });
    expect(session.summaryChoices).toEqual(["exactly-right"]);
    expect(typeof session.finalPercent).toBe("number");
  });

  it("caps the meter at 89 while a required topic is uncovered, and uncaps when covered", async () => {
    const capped = await ask({
      kind: "choice", questionId: "cap1", prompt: "Q?", questionNumber: 1,
      options: [{ value: "a", label: "a" }],
      requiredTopics: ["goal"],
      meter: { percent: 95, topics: { goal: "none" } },
    });
    expect(capped.meterApplied).toMatchObject({ percent: 89, capped: true });
    expect((capped.meterApplied as { reason?: string }).reason).toContain("goal");

    const uncapped = await ask({
      kind: "choice", questionId: "cap2", prompt: "Q?", questionNumber: 2,
      options: [{ value: "a", label: "a" }],
      requiredTopics: ["goal"],
      previousAnswer: { questionId: "cap1", answer: { choiceId: "a" } },
      meter: { percent: 95, topics: { goal: "covered" } },
    });
    expect(uncapped.meterApplied).toMatchObject({ percent: 95, capped: false });
  });

  it("keeps the interview open on summary ask-more, and counts delegated answers", async () => {
    await ask({
      kind: "start", questionId: "d1", prompt: "What are we building?", topic: "goal",
      options: [{ value: "app", label: "An app" }], questionNumber: 1, estimatedTotal: 3,
      requiredTopics: ["goal"], meter: { percent: 20, topics: { goal: "partial" } },
    });
    await ask({
      kind: "summary", questionId: "dsum1", prompt: "Summary", questionNumber: 2, estimatedTotal: 3,
      summary: { paragraph: "Draft.", items: [{ topic: "goal", text: "An app" }], delegated: [{ questionId: "d1", topic: "goal", text: "app" }] },
      previousAnswer: { questionId: "d1", answer: { choiceId: "app", delegated: true } },
      meter: { percent: 60, topics: { goal: "covered" } },
    });
    await ask({
      kind: "choice", questionId: "d2", prompt: "One more?", questionNumber: 3,
      options: [{ value: "x", label: "x" }],
      previousAnswer: { questionId: "dsum1", answer: { summaryChoice: "ask-more" } },
      meter: { percent: 70 },
    });
    let state = await readState();
    expect(state.status).not.toBe("complete");

    const metrics = await readMetrics();
    const session = metrics.sessions[metrics.sessions.length - 1];
    expect(session).toMatchObject({ answered: 2, delegated: 1 });

    // Agent asks the follow-up summary; the user approves it; the agent records
    // the approval via previousAnswer on the next call (answeredKind = "summary").
    await ask({
      kind: "summary", questionId: "dsum2", prompt: "Better?", questionNumber: 4,
      summary: { paragraph: "Final.", items: [], delegated: [{ questionId: "d1", topic: "goal", text: "app" }] },
      previousAnswer: { questionId: "d2", answer: { choiceId: "x" } },
      meter: { percent: 88, topics: { goal: "covered" } },
    });
    state = await readState();
    expect(state.status).not.toBe("complete");

    await ask({
      kind: "confirm", questionId: "ddone", prompt: "Building now.", questionNumber: 5,
      previousAnswer: { questionId: "dsum2", answer: { summaryChoice: "exactly-right" } },
      meter: { percent: 94, topics: { goal: "covered" } },
    });
    state = await readState();
    expect(state.status).toBe("complete");
  });
});
