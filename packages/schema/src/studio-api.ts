import { z } from "zod";
import { ObjectIdSchema, RevisionSchema, CrockfordULIDSchema, ChipSchema, SafeIdSchema } from "./primitives.js";
import { AnnotationIdSchema } from "./annotations.js";
import { SceneValueSchema } from "./base-object.js";
import { KeyframesSchema } from "./keyframes.js";

// Studio server API inputs for the feedback patch queue (trd 11.3; design.md 4.3, 4.8, 4.10).

export const CreatePatchInputSchema = z.object({
  sceneId: SafeIdSchema.default("default"),
  objectId: ObjectIdSchema,
  baseRevision: RevisionSchema,
  feedback: z.object({
    text: z.string().max(2000).optional(),
    chips: z.array(ChipSchema).max(7).default([]),
    annotationIds: z.array(AnnotationIdSchema).max(50).default([]),
  }),
}).refine((v) => (v.feedback.text?.trim().length ?? 0) > 0 || v.feedback.chips.length > 0 || v.feedback.annotationIds.length > 0, {
  message: "feedback.text, at least one chip, or at least one annotation is required",
});

export const UpdatePatchInputSchema = z.object({
  sceneId: SafeIdSchema.default("default"),
  feedback: z.object({
    text: z.string().min(1).max(2000).optional(),
    chips: z.array(ChipSchema).max(7).optional(),
  }),
});

export const SendPatchesInputSchema = z.object({
  sceneId: SafeIdSchema.default("default"),
  ids: z.array(CrockfordULIDSchema).max(100).optional(),
});

export const ResolvePatchInputSchema = z.object({
  sceneId: SafeIdSchema.default("default"),
  choice: z.enum(["keep-mine", "take-agents"]),
});

export const PatchListQuerySchema = z.object({
  sceneId: SafeIdSchema.default("default"),
  status: z.enum(["draft", "sent", "applied", "rejected", "conflict"]).optional(),
  limit: z.number().int().min(1).max(200).default(200),
  // base64url(JSON [createdAt, id]) of the last item of the previous page
  cursor: z.string().max(200).optional(),
});

export const InterviewAnswerInputSchema = z.object({
  sceneId: SafeIdSchema.default("default"),
  questionId: z.string().min(1).max(120),
  answer: z.unknown(),
});

/**
 * trd 352/T9 — a direct user edit of an object's `style` record (drag, resize).
 * The style value is merged by the CLIENT over the current object style and
 * sent whole; the server applies it through the same atomic pipeline the
 * agent uses. Values are SceneValue so token refs survive round-trips.
 */
export const ObjectStylePatchInputSchema = z
  .object({
    sceneId: SafeIdSchema.default("default"),
    objectId: ObjectIdSchema,
    baseRevision: RevisionSchema,
    style: z.record(z.string(), SceneValueSchema),
  })
  .refine((v) => Object.keys(v.style).length <= 200, { message: "style may carry at most 200 keys" })
  .refine((v) => JSON.stringify(v.style).length <= 64 * 1024, { message: "style payload exceeds the 64 KB limit" });

/**
 * trd 13.6 — replace the whole scene keyframes table. Full-replace, never a
 * merge: the Studio sends its working copy wholesale, one edit = one revision.
 * No object lock applies (scene-level metadata), matching the versions-restore
 * precedent. baseRevision guards against a stale client.
 */
export const KeyframesPutInputSchema = z.object({
  sceneId: SafeIdSchema.default("default"),
  baseRevision: RevisionSchema,
  keyframes: KeyframesSchema,
});

export type CreatePatchInput = z.infer<typeof CreatePatchInputSchema>;
export type UpdatePatchInput = z.infer<typeof UpdatePatchInputSchema>;
export type SendPatchesInput = z.infer<typeof SendPatchesInputSchema>;
export type ResolvePatchInput = z.infer<typeof ResolvePatchInputSchema>;
export type InterviewAnswerInput = z.infer<typeof InterviewAnswerInputSchema>;
export type ObjectStylePatchInput = z.infer<typeof ObjectStylePatchInputSchema>;
export type KeyframesPutInput = z.infer<typeof KeyframesPutInputSchema>;
