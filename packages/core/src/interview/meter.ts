/**
 * Intent Interview Meter (S-1-06, AC-M1-02).
 *
 * Computes the "Estimated understanding" meter shown to the user from slot
 * evidence only — never from agent claims (intent.md §7.2, rule I2).
 *
 * A slot's value: unknown = 0, assumed = 0.5, stated = 1.0. A later answer
 * replaces the earlier value; `reopen` sets it back to unknown. Topic score =
 * mean of its in-scope slot values. Topic status: none (<0.25), partial
 * (0.25-0.74), covered (>=0.75). serverPercent = floor(100 * Σ weight*score
 * / Σ weight). If any required topic is `none` the meter is capped at 89.
 */
import { ALL_SEEDS, Seed } from "./bank.js";

export type TaskSize = "small" | "medium" | "large";
export type Milestone = "M1" | "M2" | "M3";
export type MeterReason = "no-evidence" | "required-topic-none" | "ok";
export type Evidence = 0 | 0.5 | 1;
export type TopicStatus = "none" | "partial" | "covered";

export const EVIDENCE = { unknown: 0 as Evidence, assumed: 0.5 as Evidence, stated: 1 as Evidence };

const SLOT_DEFS = [
  { topic: "goal", weight: 20, from: "small" as TaskSize, slots: [["goal.purpose", "P1"], ["goal.platform", "P1"], ["goal.success", "P2"], ["goal.protoUse", "P2"]] as const },
  { topic: "users", weight: 10, from: "small" as TaskSize, slots: [["users.primary", "P1"], ["users.skill", "P2"], ["users.a11y", "P2"], ["users.access", "P3"], ["users.context", "P3"], ["users.intl", "P3"]] as const },
  { topic: "screens", weight: 20, from: "small" as TaskSize, slots: [["screens.list", "P1"], ["screens.nav", "P1"], ["screens.auth", "P2"], ["screens.roles", "P3"], ["screens.start", "P3"]] as const },
  { topic: "flow", weight: 15, from: "small" as TaskSize, slots: [["flow.main", "P1"], ["flow.after", "P2"], ["flow.links", "P2"], ["flow.back", "P3"]] as const },
  { topic: "style", weight: 15, from: "small" as TaskSize, slots: [["style.mood", "P1"], ["style.palette", "P1"], ["style.theme", "P1"], ["style.density", "P2"], ["style.corner", "P2"], ["style.brand", "P2"], ["deep.buttonStyle", "P2"], ["deep.imageShape", "P2"], ["style.heading", "P3"]] as const },
  { topic: "content", weight: 10, from: "small" as TaskSize, slots: [["content.tone", "P1"], ["content.data", "P1"], ["content.lang", "P2"], ["content.media", "P2"], ["content.images", "P3"], ["content.name", "P3"], ["content.legal", "P3"]] as const },
  { topic: "behavior", weight: 7, from: "medium" as TaskSize, slots: [["behavior.states", "P2"], ["behavior.forms", "P2"], ["behavior.responsive", "P2"], ["behavior.motion", "P3"]] as const },
  { topic: "edge-cases", weight: 3, from: "large" as TaskSize, slots: [["edge.empty", "P3"], ["edge.long", "P3"], ["edge.fail", "P3"]] as const },
] as const;

const REQUIRED = new Set(["goal", "users", "screens", "flow", "style", "content"]);
const TOPIC_PRIORITY = ["goal", "users", "screens", "flow", "style", "content", "behavior", "edge-cases"];
const SIZE_RANK = { small: 1, medium: 2, large: 3 } as const;
const TIER_RANK: Record<string, number> = { P1: 1, P2: 2, P3: 3 };

// Slots in scope are fixed by size + tier (intent.md §2.2); milestone gates which
// seeds are asked, not which slots exist. small=11, medium=25, large=35.
export function activeTopics(size: TaskSize): string[] {
  return SLOT_DEFS.filter((t) => SIZE_RANK[size] >= SIZE_RANK[t.from]).map((t) => t.topic);
}

/** Slots in scope: by tier cap for the size (small=P1, medium=P1+P2, large=all). */
export function slotsInScope(size: TaskSize): string[] {
  const tierCap = SIZE_RANK[size];
  const out: string[] = [];
  for (const def of SLOT_DEFS) {
    if (SIZE_RANK[size] < SIZE_RANK[def.from]) continue;
    for (const [slot, tier] of def.slots) {
      if ((TIER_RANK[tier] ?? 99) <= tierCap) out.push(slot);
    }
  }
  return out;
}

export interface MeterEstimate {
  percent: number;
  serverPercent: number;
  capped: boolean;
  reason: MeterReason;
  topicStatus: Record<string, TopicStatus>;
}

export function estimateMeter(
  evidence: Record<string, Evidence | undefined>,
  opts: { size: TaskSize }
): MeterEstimate {
  const { size } = opts;
  const active = activeTopics(size);
  const scope = new Set(slotsInScope(size));
  const totalWeight = SLOT_DEFS.filter((t) => active.includes(t.topic)).reduce((s, t) => s + t.weight, 0);

  const scores: Record<string, number> = {};
  let weighted = 0;
  for (const def of SLOT_DEFS) {
    if (!active.includes(def.topic)) continue;
    const vals: number[] = [];
    for (const [slot] of def.slots) {
      if (!scope.has(slot)) continue;
      const v = evidence[slot] ?? 0;
      vals.push(v);
    }
    const score = vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
    scores[def.topic] = score;
    weighted += def.weight * score;
  }

  const serverPercent = totalWeight === 0 ? 0 : Math.floor((weighted * 100) / totalWeight);
  const topicStatus: Record<string, TopicStatus> = {};
  for (const def of SLOT_DEFS) {
    if (!active.includes(def.topic)) continue;
    const s = scores[def.topic] ?? 0;
    topicStatus[def.topic] = s < 0.25 ? "none" : s < 0.75 ? "partial" : "covered";
  }

  const requiredNone = active.some((t) => REQUIRED.has(t) && topicStatus[t] === "none");
  const percent = requiredNone ? Math.min(serverPercent, 89) : serverPercent;
  const capped = percent !== serverPercent;
  return {
    percent,
    serverPercent,
    capped,
    reason: requiredNone ? "required-topic-none" : percent === 0 ? "no-evidence" : "ok",
    topicStatus,
  };
}

export interface InterviewView {
  taskSize: TaskSize;
  evidence: Map<string, Evidence>;
  asked: string[];
  consecutiveNonAnswers: number;
}

export function createInterviewView(size: TaskSize): InterviewView {
  return { taskSize: size, evidence: new Map(), asked: [], consecutiveNonAnswers: 0 };
}

/** Next question in deterministic priority order: P1→P2→P3 within topic priority, skipping answered slots. */
export function nextQuestion(view: InterviewView): Seed | null {
  const scope = new Set(slotsInScope(view.taskSize));
  const candidates = ALL_SEEDS.filter((s: Seed) => s.profileKey && scope.has(s.profileKey));
  const topicOf = (s: Seed) => (s.profileKey ?? "").split(".")[0] ?? "";
  candidates.sort((a: Seed, b: Seed) => {
    const pa = TOPIC_PRIORITY.indexOf(topicOf(a));
    const pb = TOPIC_PRIORITY.indexOf(topicOf(b));
    if (pa !== pb) return pa - pb;
    return (TIER_RANK[a.tier] ?? 9) - (TIER_RANK[b.tier] ?? 9);
  });
  for (const seed of candidates) {
    const slot = seed.profileKey as string;
    if (!view.evidence.has(slot)) {
      view.asked.push(slot);
      return seed;
    }
  }
  return null;
}

export function answerSlot(view: InterviewView, slot: string, value: Evidence): void {
  view.evidence.set(slot, value);
  view.consecutiveNonAnswers = 0;
}

/** Delegate or skip: assumed (0.5), fatigue counter increments (SC-4 triggers at 3). */
export function delegateOrSkip(view: InterviewView, slot: string): void {
  view.evidence.set(slot, EVIDENCE.assumed);
  view.consecutiveNonAnswers += 1;
}

/** SC-4: true when the user has deferred/answered-nothing 3 times in a row —
 *  the harness should offer to delegate the rest or show the summary. */
export function fatigueReached(view: InterviewView): boolean {
  return view.consecutiveNonAnswers >= 3;
}

/** Reopen a slot: back to unknown, meter falls honestly (SC-7). */
export function reopenSlot(view: InterviewView, slot: string): void {
  view.evidence.set(slot, EVIDENCE.unknown);
  view.consecutiveNonAnswers = 0;
}

export function meterFor(view: InterviewView): MeterEstimate {
  const rec: Record<string, Evidence> = {};
  for (const [slot, value] of view.evidence) rec[slot] = value;
  return estimateMeter(rec, { size: view.taskSize });
}
