import type { InterviewState } from "@intent/schema";

// ---------- Lock helpers ----------

/** Effective locked set: direct locks + descendants of locked containers. */
export function lockedWithDescendantsLocal(
  scene: { objects: Record<string, { children?: string[] }> } | null,
  locked: readonly string[],
): string[] {
  const out = new Set(locked);
  if (!scene) return [...out];
  const stack = [...locked];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    const children = scene.objects[id]?.children ?? [];
    for (const child of children) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return [...out];
}

// ---------- Interview helpers (trd 10.2, design 2.1-2.4) ----------

export function freshInterviewState(): InterviewState {
  return {
    version: 1,
    status: "in_progress",
    currentQuestionIndex: 0,
    meter: 0,
    meterTopics: {},
    requiredTopics: [],
    answeredTopics: [],
    delegated: false,
    delegatedAt: null,
    briefId: null,
    updatedAt: new Date().toISOString(),
    pendingQuestion: null,
    answers: [],
  };
}

export function dedupe(list: readonly string[]): string[] {
  return Array.from(new Set(list));
}

/** Render the plain-text card (design.md 2.4); the Studio Interview tab renders the same content. */
export function renderPlainTextCard(
  input: {
    questionId: string;
    kind: string;
    prompt: string;
    options?: readonly { value: string; label: string; description?: string }[];
    questionNumber?: number;
    estimatedTotal?: number;
    round?: string;
    topic?: string;
    requiredTopics?: readonly string[];
    meter?: { percent: number; topics?: Record<string, "none" | "partial" | "covered"> };
  },
  meterPercent: number,
): string {
  const total = input.estimatedTotal ?? 15;
  const n = input.questionNumber ?? 1;
  const topic = input.round ?? input.topic ?? "Interview";
  const lines = [`Question ${n} of about ${total} | Understanding: ~${Math.round(meterPercent)}% (estimate) | Round: ${topic}`];
  lines.push(input.prompt);
  if (input.kind === "choice" || input.kind === "start") {
    (input.options ?? []).forEach((o, i) => lines.push(`  ${i + 1}) ${o.label}`));
  }
  lines.push("  0) Don't know, you choose");
  lines.push("  s) Skip");
  lines.push("Reply with a number, or describe it in your own words.");
  return lines.join("\n");
}

export function applyMeterUpdate(
  state: InterviewState,
  meter: { percent: number; topics?: Record<string, "none" | "partial" | "covered"> } | undefined,
) {
  if (!meter) return;
  state.meter = Math.min(100, Math.max(0, Math.round(meter.percent)));
  if (meter.topics) {
    state.meterTopics = { ...state.meterTopics, ...meter.topics };
  }
}

/** Owner ruling (2026-11-21): no percentage cap — the interview keeps asking
 *  until understanding is 100%. A missing required topic is reported as a
 *  hint (not a lowered number) so the agent knows to ask more. */
export function meterWithRequiredTopicCap(
  percent: number,
  requiredTopics: readonly string[],
  topics: Record<string, "none" | "partial" | "covered">,
) {
  const missing = requiredTopics.filter((t) => (topics[t] ?? "none") === "none");
  return {
    percent: Math.min(100, Math.max(0, percent)),
    capped: false as const,
    ...(missing.length > 0 ? { reason: `Ask more — required topic not covered: ${missing[0]}` } : {}),
  };
}
