import { z } from "zod";
import { CrockfordULIDSchema, ISODateTimeSchema } from "./primitives.js";

/**
 * trd 17.1 — the Intent Profile (learned preferences).
 *
 * An entry is created only after 2 consistent signals or 1 explicit statement
 * ("always", "never", "I prefer"). Keys come from a closed list; free-form
 * keys are rejected. Entries never contain scene text — only normalized
 * choices, so the profile is safe to send to the agent as a summary.
 *
 * Stored at .intent/intent-profile.json (kept separate from the M1 `Profile`
 * preferences file so old readers keep working).
 */

export const INTENT_PROFILE_KEYS = [
  "style.density",
  "style.corner",
  "style.palette",
  "style.motion",
  "style.contrast",
  "content.tone",
  "content.language",
  "layout.navigation",
  "layout.layout",
  "dislikes",
] as const;
export type IntentProfileKey = (typeof INTENT_PROFILE_KEYS)[number];

export const IntentProfileEntrySourceSchema = z.strictObject({
  kind: z.enum(["answer", "edit", "rejection"]),
  /** Ids supporting this entry (interview answers have questionIds, patches have ULIDs). */
  refs: z.array(z.string().min(1).max(200)).max(20),
});
export type IntentProfileEntrySource = z.infer<typeof IntentProfileEntrySourceSchema>;

export const IntentProfileEntrySchema = z.strictObject({
  id: CrockfordULIDSchema,
  key: z.enum(INTENT_PROFILE_KEYS),
  value: z.unknown(),
  text: z.string().max(200),
  source: IntentProfileEntrySourceSchema,
  count: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
});
export type IntentProfileEntry = z.infer<typeof IntentProfileEntrySchema>;

export const IntentProfileSchema = z.strictObject({
  schemaVersion: z.literal(1),
  entries: z.array(IntentProfileEntrySchema).max(100).default([]),
});
export type IntentProfile = z.infer<typeof IntentProfileSchema>;
