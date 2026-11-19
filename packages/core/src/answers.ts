import type { InterviewState } from "@intent/schema";

/**
 * trd 10.2 / schema cap — `InterviewState.answers` is bounded to 200 entries
 * by InterviewStateSchema, and nothing else caps it. Without pruning, the
 * interview eventually bricks every subsequent read (E_SCHEMA on a >200 file).
 * Keep the newest 200 entries — the oldest answers (consumed or not) are the
 * safest to drop. The TC-INT-17 studio-wins rule relies on consumed studio
 * answers persisting, so pruning is cap-driven only, never consume-driven.
 */
export function pruneConsumedAnswers(state: InterviewState, max: number = 200): InterviewState {
  if (!Array.isArray(state.answers)) return state;
  if (state.answers.length <= max) return state;
  return { ...state, answers: state.answers.slice(-max) };
}
