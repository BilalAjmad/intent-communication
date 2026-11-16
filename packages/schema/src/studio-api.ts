import { z } from "zod";
import { ObjectIdSchema, RevisionSchema, CrockfordULIDSchema, ChipSchema, SafeIdSchema } from "./primitives.js";

// Studio server API inputs for the feedback patch queue (trd 11.3; design.md 4.3, 4.8, 4.10).
export const CreatePatchInputSchema = z.object({
  sceneId: SafeIdSchema.default("default"),
  objectId: ObjectIdSchema,
  baseRevision: RevisionSchema,
  feedback: z.object({
    text: z.string().max(2000).optional(),
    chips: z.array(ChipSchema).max(7).default([]),
  }),
}).refine((v) => (v.feedback.text?.trim().length ?? 0) > 0 || v.feedback.chips.length > 0, {
  message: "feedback.text or at least one chip is required",
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

export type CreatePatchInput = z.infer<typeof CreatePatchInputSchema>;
export type UpdatePatchInput = z.infer<typeof UpdatePatchInputSchema>;
export type SendPatchesInput = z.infer<typeof SendPatchesInputSchema>;
export type ResolvePatchInput = z.infer<typeof ResolvePatchInputSchema>;
export type InterviewAnswerInput = z.infer<typeof InterviewAnswerInputSchema>;
