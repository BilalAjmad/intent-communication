import type { StoragePort } from "./ports.js";
import type { InterviewMetrics, InterviewMetricsSession } from "@intent/schema";

/**
 * intent.md §12 — per-session interview telemetry (`.intent/metrics.json`).
 *
 * Best effort: any failure here must never break the interview.
 *
 * Honest-collection contract (see interview-metrics.ts in @intent/schema for
 * the file-level note):
 *   - `harvested`, `prefilledConfirmed`, `prefilledChanged` are NOT collected
 *     on the current contract (they require the unapplied I1/I5 amendments).
 *   - `delegated` / `skipped` are collected from the agent-supplied
 *     `previousAnswer.delegated|skipped` opt-in markers.
 *   - Everything else is derived deterministically at answer time.
 *
 * Session lifecycle: a session opens on `kind: "start"` (or lazily on the
 * first question of any kind). It closes when the user answers a summary
 * question with "exactly-right" (`finalPercent` = meter after the cap) — the
 * same condition that flips status to "complete". A `kind: "start"` seen
 * while a previous session is open marks that session `abandoned` (or drops
 * it if it never asked anything). Only the last 50 sessions are kept.
 */

export interface InterviewMetricsInput {
  /** ask_user kind of THIS call ("start" | "summary" | "choice" | …). */
  kind: string | null;
  /** The answer being recorded on this call, if any, and the question kind it answers. */
  recordedAnswer?: { answer: unknown; questionKind: string | null } | null;
  /** Question number of the question being ASKED by this call. */
  questionNumber?: number;
  /** state.currentQuestionIndex of the interview (fallback for asked). */
  currentQuestionIndex?: number;
  /** Meter after the required-topic cap was applied (state.meter at write time). */
  meterAfter: number;
  /** True when this call capped the meter at 89 because a required topic was uncovered. */
  capped: boolean;
  /** True when a preFilled suggestion was returned on this call. */
  preFilledShown: boolean;
  now?: string;
}

const clampInt = (v: number): number => Math.min(100, Math.max(0, Math.round(v)));

function extractSummaryChoice(answer: unknown): "exactly-right" | "change" | "ask-more" | null {
  if (!answer || typeof answer !== "object") return null;
  const v = (answer as Record<string, unknown>)["summaryChoice"];
  if (v === "exactly-right" || v === "change" || v === "ask-more") return v;
  return null;
}

function openSession(nowIso: string): InterviewMetricsSession {
  return {
    sessionKey: nowIso,
    asked: 0,
    answered: 0,
    prefilledShown: 0,
    serverCaps: 0,
    summaryChoices: [],
    finalPercent: null,
    abandoned: false,
  };
}

export async function recordInterviewMetrics(storage: StoragePort, input: InterviewMetricsInput): Promise<void> {
  try {
    const metrics = await storage.readInterviewMetrics();
    const sessions = metrics.sessions.map((s) => ({ ...s }));

    // 1) Close any open session when a NEW interview starts.
    if (input.kind === "start") {
      for (let i = sessions.length - 1; i >= 0; i -= 1) {
        const s = sessions[i]!;
        if (s.finalPercent === null && !s.abandoned) {
          if (s.asked > 0 || s.answered > 0 || s.summaryChoices.length > 0) {
            sessions[i] = { ...s, abandoned: true };
          } else {
            sessions.splice(i, 1);
          }
          break;
        }
      }
    }

    // 2) Ensure an open session exists for this question.
    let openIndex = -1;
    for (let i = sessions.length - 1; i >= 0; i -= 1) {
      if (sessions[i]!.finalPercent === null && !sessions[i]!.abandoned) {
        openIndex = i;
        break;
      }
    }
    if (openIndex === -1) {
      sessions.push(openSession(input.now ?? new Date().toISOString()));
      openIndex = sessions.length - 1;
    }

    let s = sessions[openIndex]!;

    // 3) Question counters (questions ASKED).
    const askedThisCall =
      typeof input.questionNumber === "number"
        ? input.questionNumber
        : typeof input.currentQuestionIndex === "number"
          ? input.currentQuestionIndex + 1
          : 0;
    s = { ...s, asked: Math.max(s.asked, Math.max(0, Math.round(askedThisCall))) };
    if (input.preFilledShown) s = { ...s, prefilledShown: s.prefilledShown + 1 };
    if (input.capped) s = { ...s, serverCaps: s.serverCaps + 1 };

    // 4) Answer counters.
    const recorded = input.recordedAnswer;
    if (recorded) {
      s = { ...s, answered: s.answered + 1 };
      if (recorded.answer && typeof recorded.answer === "object") {
        const obj = recorded.answer as Record<string, unknown>;
        if (obj["delegated"] === true) s = { ...s, delegated: (s.delegated ?? 0) + 1 };
        if (obj["skipped"] === true) s = { ...s, skipped: (s.skipped ?? 0) + 1 };
      }
      const choice = extractSummaryChoice(recorded.answer);
      if (recorded.questionKind === "summary" && choice) {
        // Keep the newest choices only — the schema caps summaryChoices at 20.
        s = { ...s, summaryChoices: [...s.summaryChoices.slice(-19), choice] };
        if (choice === "exactly-right") {
          s = { ...s, finalPercent: clampInt(input.meterAfter) };
        }
      }
    }

    sessions[openIndex] = s;
    await storage.writeInterviewMetrics({ schemaVersion: 1, sessions: sessions.slice(-50) });
  } catch {
    // Telemetry is best effort — never breaks the interview.
  }
}

export interface InterviewEfficiencyReport {
  sessions: number;
  askedPerSession: number[];
  avgAsked: number | null;
  /** Σ delegated / Σ answered, over sessions that reported the marker; null when none did. */
  delegateRate: number | null;
  /** Σ confirmed / (Σ confirmed + Σ changed), over sessions that collected both; null otherwise. */
  prefillAcceptance: number | null;
  /** Share of decided sessions (≥1 summary choice) whose FIRST choice was "exactly-right"; null otherwise. */
  firstSummaryApprovalShare: number | null;
}

/** Pure derivation of the §12 report. TC-MET-04: hand-built fixture → exact numbers. */
export function summarizeInterviewMetrics(metrics: InterviewMetrics): InterviewEfficiencyReport {
  const sessions = metrics.sessions;
  const askedPerSession = sessions.map((s) => s.asked);
  const totalAsked = askedPerSession.reduce((a, b) => a + b, 0);
  const avgAsked = sessions.length > 0 ? totalAsked / sessions.length : null;

  let answeredTotal = 0;
  let delegatedTotal = 0;
  let markerSeen = false;
  let confirmedTotal = 0;
  let changedTotal = 0;
  let prefillSeen = false;
  for (const s of sessions) {
    answeredTotal += s.answered;
    if (typeof s.delegated === "number" || typeof s.skipped === "number") markerSeen = true;
    delegatedTotal += s.delegated ?? 0;
    if (typeof s.prefilledConfirmed === "number" && typeof s.prefilledChanged === "number") {
      confirmedTotal += s.prefilledConfirmed;
      changedTotal += s.prefilledChanged;
      prefillSeen = true;
    }
  }
  const delegateRate = markerSeen && answeredTotal > 0 ? delegatedTotal / answeredTotal : null;
  const prefillAcceptance = prefillSeen && confirmedTotal + changedTotal > 0 ? confirmedTotal / (confirmedTotal + changedTotal) : null;

  const decided = sessions.filter((s) => s.summaryChoices.length > 0);
  const firstSummaryApprovalShare = decided.length > 0
    ? decided.filter((s) => s.summaryChoices[0] === "exactly-right").length / decided.length
    : null;

  return { sessions: sessions.length, askedPerSession, avgAsked, delegateRate, prefillAcceptance, firstSummaryApprovalShare };
}

// Re-export keeps the writer-side type names short for call sites.
export type { InterviewMetricsSession, InterviewMetrics };
