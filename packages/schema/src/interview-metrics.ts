import { z } from "zod";
import { ISODateTimeSchema } from "./primitives.js";

/**
 * intent.md §12 — `.intent/metrics.json` (gitignored). Per-session interview
 * telemetry, computed on demand and shown in the Studio; never sent anywhere.
 *
 * Honest-collection note (2026-11-18 change log): three §12 fields depend on
 * contract amendments that are proposed-but-unapplied (I1 kind:start payload,
 * I5/I6 harvesting & remember affordances): `harvested`, `prefilledConfirmed`,
 * `prefilledChanged` are OMITTED from the file on the current contract rather
 * than written as fake zeros. `delegated`/`skipped` are collected from the
 * agent-supplied `previousAnswer.delegated|skipped` markers (opt-in); until an
 * agent sets them they read as 0. Everything else (asked, answered,
 * prefilledShown, serverCaps, summaryChoices, finalPercent, abandoned) is
 * derived deterministically at answer time.
 */

export const InterviewMetricsSessionSchema = z.strictObject({
  sessionKey: ISODateTimeSchema,
  asked: z.number().int().nonnegative(),
  answered: z.number().int().nonnegative(),
  /** Opt-in agent marker (see module note). Absent ⇒ no delegated answers reported. */
  delegated: z.number().int().nonnegative().optional(),
  /** Opt-in agent marker (see module note). Absent ⇒ no skipped answers reported. */
  skipped: z.number().int().nonnegative().optional(),
  /** Requires the I1 reconciliation (harvested quotes in kind:start). Not collected on the current contract. */
  harvested: z.number().int().nonnegative().optional(),
  prefilledShown: z.number().int().nonnegative().default(0),
  /** Not derivable honestly on the current contract — omitted rather than faked. */
  prefilledConfirmed: z.number().int().nonnegative().optional(),
  prefilledChanged: z.number().int().nonnegative().optional(),
  /** Times the server capped the meter at 89 because a required topic was uncovered. */
  serverCaps: z.number().int().nonnegative().default(0),
  summaryChoices: z.array(z.enum(["exactly-right", "change", "ask-more"])).max(20).default([]),
  finalPercent: z.number().int().min(0).max(100).nullable().default(null),
  abandoned: z.boolean().default(false),
});
export type InterviewMetricsSession = z.infer<typeof InterviewMetricsSessionSchema>;

export const InterviewMetricsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  sessions: z.array(InterviewMetricsSessionSchema).max(50),
});
export type InterviewMetrics = z.infer<typeof InterviewMetricsSchema>;

export function validateInterviewMetrics(data: unknown): InterviewMetrics {
  return InterviewMetricsSchema.parse(data);
}
