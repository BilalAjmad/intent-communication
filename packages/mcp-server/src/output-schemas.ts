import { z } from "zod";
import { GetSceneOutputSchema, ApplyPatchOutputSchema, GetFeedbackOutputSchema } from "@intent/schema";

/**
 * trd 14.3 — output contracts for every tool. A handler returning a payload
 * outside its schema is a bug; handleMCPRequest throws E_INTERNAL with issue
 * paths only (never echoes the payload — it may contain scene data).
 */

const AskUserOutputSchema = z.object({
  questionId: z.string().min(1).max(120),
  renderedText: z.string().max(64 * 1024),
  studio: z.object({ open: z.boolean(), url: z.string().max(2048) }),
  meterApplied: z.object({
    percent: z.number().min(0).max(100),
    capped: z.boolean(),
    reason: z.string().max(120).optional(),
  }),
  budget: z.object({ asked: z.number().int().nonnegative(), softCap: z.number().int().positive(), over: z.boolean() }),
  delegated: z.boolean().optional(),
  note: z.string().max(500).optional(),
  hint: z.string().max(500).optional(),
  recorded: z.object({ previousQuestionId: z.string().max(120) }).optional(),
  preFilled: z.unknown().optional(),
});

const OpenStudioOutputSchema = z.object({
  url: z.string().max(2048),
  sessionId: z.string().max(120),
});

const ValidateOutputSchema = z.object({
  valid: z.boolean(),
  lint: z.unknown().optional(),
  error: z.string().max(2000).optional(),
});

export const OUTPUT_SCHEMAS: Record<string, z.ZodTypeAny> = {
  get_scene: GetSceneOutputSchema,
  apply_patch: ApplyPatchOutputSchema,
  get_feedback: GetFeedbackOutputSchema,
  ask_user: AskUserOutputSchema,
  open_studio: OpenStudioOutputSchema,
  validate: ValidateOutputSchema,
};
