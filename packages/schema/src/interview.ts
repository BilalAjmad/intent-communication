import { z } from "zod";
import { ISODateTimeSchema } from "./primitives.js";

// Shared interview question shape (trd 10.2 subset).
// kind: start = start-of-interview question; summary = summary question carrying
// the paragraph/items/delegated payload the Studio renders as the summary screen.
export const InterviewQuestionCoreSchema = z.object({
  questionId: z.string().min(1).max(120),
  kind: z.enum(["start", "choice", "text", "scale", "confirm", "skip"]),
  prompt: z.string().min(1).max(2000),
  options: z.array(z.object({
    value: z.string().max(100),
    label: z.string().max(200),
    description: z.string().max(500).optional(),
  })).max(10).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  topic: z.string().max(40).optional(),
  round: z.string().max(40).optional(),
  questionNumber: z.number().int().nonnegative().optional(),
  estimatedTotal: z.number().int().min(1).max(100).optional(),
  whyAsked: z.string().max(200).optional(),
  requiredTopics: z.array(z.string().max(40)).max(50).optional(),
  meter: z.object({
    percent: z.number().min(0).max(100),
    topics: z.record(z.string(), z.enum(["none", "partial", "covered"])).optional(),
    estimatedTotal: z.number().int().min(1).max(100).optional(),
  }).optional(),
  summary: z.object({
    paragraph: z.string().max(800).optional(),
    items: z.array(z.object({ topic: z.string().max(40), text: z.string().max(300) })).max(50),
    delegated: z.array(z.object({ questionId: z.string().max(120), topic: z.string().max(40), text: z.string().max(200) })).max(50),
  }).optional(),
});

export const PendingInterviewQuestionSchema = InterviewQuestionCoreSchema.extend({
  askedAt: ISODateTimeSchema,
});

export const InterviewAnswerSchema = z.object({
  questionId: z.string().min(1).max(120),
  answer: z.unknown(),
  via: z.enum(["studio", "chat"]),
  answeredAt: ISODateTimeSchema,
  consumed: z.boolean().default(false),
  note: z.string().max(200).optional(),
});

export const AskUserInputSchema = InterviewQuestionCoreSchema.extend({
  previousAnswer: z.unknown().optional(),
});

export type InterviewQuestionCore = z.infer<typeof InterviewQuestionCoreSchema>;
export type PendingInterviewQuestion = z.infer<typeof PendingInterviewQuestionSchema>;
export type InterviewAnswer = z.infer<typeof InterviewAnswerSchema>;
export type AskUserInput = z.infer<typeof AskUserInputSchema>;
