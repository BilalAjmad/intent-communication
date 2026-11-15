import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createMCPContext, handleMCPRequest, MCPContext } from "./index";

// TC-INT-17 — Studio first: an answer given in the Studio is returned by get_feedback once;
// a later chat answer for the same questionId is ignored with a note (trd 10.4 / test.md).

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene() {
  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN,
        type: "screen",
        parentId: null,
        children: [TEXT],
        props: { title: "Interview", width: 390, height: 844 },
        style: {},
        meta: {},
      },
    },
    objects: {
      [TEXT]: { id: TEXT, type: "text", parentId: SCREEN, children: [], props: { content: "Hello" }, style: {}, meta: {} },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Interview", tags: [] },
  };
}

function freshState() {
  return {
    version: 1 as const,
    status: "in_progress" as const,
    currentQuestionIndex: 3,
    meter: 55,
    meterTopics: { goal: "covered" as const, users: "partial" as const },
    requiredTopics: ["goal", "users"],
    answeredTopics: ["goal"],
    delegated: false,
    delegatedAt: null,
    briefId: null,
    updatedAt: "2026-11-13T00:00:00.000Z",
    pendingQuestion: null,
    answers: [] as { questionId: string; answer: unknown; via: "studio" | "chat"; answeredAt: string; consumed: boolean }[],
  };
}

let testDir: string;
let context: MCPContext;

beforeAll(async () => {
  testDir = resolve(os.tmpdir(), `.test-mcp-interview-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  const scenesDir = resolve(testDir, ".intent", "scenes");
  const interviewDir = resolve(testDir, ".intent", "interview");
  await fs.mkdir(scenesDir, { recursive: true });
  await fs.mkdir(interviewDir, { recursive: true });
  await fs.writeFile(resolve(scenesDir, `${SCREEN}.json`), JSON.stringify(makeScene()), "utf-8");
  await fs.writeFile(resolve(interviewDir, "state.json"), JSON.stringify(freshState()), "utf-8");
  context = createMCPContext(testDir);
});

afterAll(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

async function readState() {
  const raw = await fs.readFile(resolve(testDir, ".intent", "interview", "state.json"), "utf-8");
  return JSON.parse(raw);
}

describe("TC-INT-17 — Studio answer wins; delivered exactly once", () => {
  it("Studio answer is returned by get_feedback exactly once", async () => {
    // 1) Agent asks a question (it lands in .intent/interview/state.json as pending)
    const ask = (await handleMCPRequest(
      "ask_user",
      { questionId: "q-goal-1", kind: "choice", prompt: "What is the goal?", options: [{ value: "bookings", label: "More bookings" }] },
      context,
    )) as { renderedText: string; questionId: string };
    expect(ask.questionId).toBe("q-goal-1");

    // 2) The user answers in the Studio (write the gate's answer record exactly like /api/interview/answer does)
    const stateAfterAsk = await readState();
    expect(stateAfterAsk.pendingQuestion?.questionId).toBe("q-goal-1");
    await fs.writeFile(
      resolve(testDir, ".intent", "interview", "state.json"),
      JSON.stringify({
        ...stateAfterAsk,
        pendingQuestion: null,
        answers: [
          ...stateAfterAsk.answers,
          { questionId: "q-goal-1", answer: "bookings", via: "studio", answeredAt: new Date().toISOString(), consumed: false },
        ],
        updatedAt: new Date().toISOString(),
      }),
      "utf-8",
    );

    // 3) get_feedback returns the studio answer once…
    const first = (await handleMCPRequest("get_feedback", { sceneId: SCREEN }, context)) as {
      interviewAnswers: { questionId: string; answer: unknown; via: string }[];
    };
    expect(first.interviewAnswers).toHaveLength(1);
    expect(first.interviewAnswers[0].answer).toBe("bookings");
    expect(first.interviewAnswers[0].via).toBe("studio");

    // …and not again on a second call
    const second = (await handleMCPRequest("get_feedback", { sceneId: SCREEN }, context)) as {
      interviewAnswers: { questionId: string; answer: unknown; via: string }[];
    };
    expect(second.interviewAnswers).toHaveLength(0);
  }, 15000);

  it("a later chat answer for the same questionId is ignored with a note", async () => {
    // State already has a consumed studio answer for q-goal-1 from the previous test.
    const ask = (await handleMCPRequest(
      "ask_user",
      {
        questionId: "q-users-1",
        kind: "choice",
        prompt: "Who are the users?",
        options: [{ value: "locals", label: "Locals" }],
        previousAnswer: { questionId: "q-goal-1", answer: "chat-override" },
      },
      context,
    )) as { note?: string };
    expect(ask.note).toMatch(/studio answer/i);

    // The chat override was NOT recorded
    const state = await readState();
    expect(state.answers.find((a: { questionId: string }) => a.questionId === "q-goal-1" && a.via === "chat")).toBeUndefined();
  }, 15000);

  it("an unconsumed studio answer also wins over an arriving chat answer", async () => {
    // Fresh unconsumed studio answer
    const ask = (await handleMCPRequest(
      "ask_user",
      { questionId: "q-style-1", kind: "choice", prompt: "Which style?", options: [{ value: "minimal", label: "Minimal" }] },
      context,
    )) as Record<string, unknown>;
    expect(ask.questionId).toBe("q-style-1");
    const stateAfterAsk = await readState();
    await fs.writeFile(
      resolve(testDir, ".intent", "interview", "state.json"),
      JSON.stringify({
        ...stateAfterAsk,
        pendingQuestion: null,
        answers: [
          ...stateAfterAsk.answers,
          { questionId: "q-style-1", answer: "minimal", via: "studio", answeredAt: new Date().toISOString(), consumed: false },
        ],
        updatedAt: new Date().toISOString(),
      }),
      "utf-8",
    );
    const chatAnswer = await handleMCPRequest(
      "ask_user",
      {
        questionId: "q-flow-1",
        kind: "choice",
        prompt: "Which flow?",
        options: [{ value: "tabs", label: "Tabs" }],
        previousAnswer: { questionId: "q-style-1", answer: "bold" },
      },
      context,
    );
    expect((chatAnswer as { note?: string }).note).toMatch(/studio answer/i);
    const state = await readState();
    expect(state.answers.filter((a: { questionId: string; via: string }) => a.questionId === "q-style-1" && a.via === "chat")).toHaveLength(0);
    expect(state.answers.filter((a: { questionId: string; via: string }) => a.questionId === "q-style-1" && a.via === "studio")).toHaveLength(1);
  }, 15000);
});
