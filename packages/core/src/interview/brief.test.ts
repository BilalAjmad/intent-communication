import { describe, it, expect } from "vitest";
import type { Brief, InterviewState } from "@intent/schema";
import { buildApprovedBrief, approveInterview, newBriefId } from "./brief.js";

const NOW = "2026-11-21T09:00:00.000Z";

function state(overrides: Partial<InterviewState> = {}): InterviewState {
  return {
    version: 1,
    status: "in_progress",
    currentQuestionIndex: 3,
    meter: 100,
    meterTopics: {},
    requiredTopics: ["goal", "content"],
    answeredTopics: [],
    delegated: false,
    delegatedAt: null,
    briefId: null,
    updatedAt: NOW,
    pendingQuestion: null,
    answers: [],
    ...overrides,
  };
}

describe("buildApprovedBrief (final master order: /intent saves brief.json)", () => {
  it("copies only recorded evidence — never invents colors, names or metrics", () => {
    const brief = buildApprovedBrief(
      state({
        lastSummary: {
          paragraph: "A playful app for families.",
          items: [
            { topic: "goal", text: "A family budgeting app" },
            { topic: "users", text: "Parents who share a household" },
            { topic: "style", text: "Playful, rounded" },
            { topic: "content", text: "Plain English, no jargon" },
          ],
          delegated: [],
        },
      }),
      { id: newBriefId(), now: NOW },
    );
    expect(brief.id).toMatch(/^c_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(brief.title).toBe("A playful app for families.");
    expect(brief.goals).toEqual(["A family budgeting app"]);
    expect(brief.targetAudience).toBe("Parents who share a household");
    expect(brief.designDirection.tone).toBe("Playful, rounded");
    expect(brief.designDirection.palette).toEqual([]);
    expect(brief.designDirection.typography).toBeUndefined();
    expect(brief.approvalStatus).toBe("approved");
    expect(brief.approvedAt).toBe(NOW);
    expect(brief.approvedBy).toBe("user");
  });

  it("falls back to recorded answers when no summary snapshot exists", () => {
    const brief = buildApprovedBrief(
      state({
        answers: [
          { questionId: "q1", answer: { choiceId: "app" }, via: "studio", answeredAt: NOW, consumed: true, topic: "goal" },
          { questionId: "q2", answer: "Lena, 34", via: "chat", answeredAt: NOW, consumed: true, topic: "users" },
        ],
      }),
      { id: newBriefId(), now: NOW },
    );
    expect(brief.goals).toEqual(["app"]);
    expect(brief.targetAudience).toBe("Lena, 34");
    expect(brief.summary).toContain("2 recorded answers");
  });

  it("leaves fields empty when there is no evidence", () => {
    const brief = buildApprovedBrief(state(), { id: newBriefId(), now: NOW });
    expect(brief.goals).toEqual([]);
    expect(brief.targetAudience).toBeUndefined();
    expect(brief.title).toBe("Project Brief");
    expect(brief.summary).toContain("0 recorded answers");
  });
});

describe("approveInterview", () => {
  it("writes the brief, links it to the state and marks the interview complete", async () => {
    const written: Brief[] = [];
    const states: InterviewState[] = [];
    const storage = {
      writeBrief: async (brief: Brief) => {
        written.push(brief);
      },
      writeInterviewState: async (s: InterviewState) => {
        states.push(s);
      },
    };
    const s = state();
    const brief = await approveInterview(storage, s, NOW);
    expect(written).toHaveLength(1);
    expect(written[0]?.id).toBe(brief.id);
    expect(states).toHaveLength(1);
    expect(states[0]?.briefId).toBe(brief.id);
    expect(states[0]?.status).toBe("complete");
    expect(states[0]?.updatedAt).toBe(NOW);
    expect(s.briefId).toBe(brief.id);
    expect(s.status).toBe("complete");
  });
});
