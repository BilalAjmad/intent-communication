import { z } from "zod";
import { CrockfordULIDSchema, ISODateTimeSchema, RevisionSchema, ObjectIdSchema, ScreenIdSchema, SafeIdSchema, ChipSchema } from "./primitives.js";
import { InterviewQuestionCoreSchema, PendingInterviewQuestionSchema, InterviewAnswerSchema, AskUserInputSchema, type AskUserInput } from "./interview.js";
import { CreatePatchInputSchema, UpdatePatchInputSchema, SendPatchesInputSchema, ResolvePatchInputSchema, PatchListQuerySchema, InterviewAnswerInputSchema } from "./studio-api.js";
import { SceneValueSchema, BaseObjectSchema } from "./base-object.js";
import { CheckboxSchema, RadioSchema, SwitchSchema, LinkSchema, ListSchema, ModalSchema, IconSchema, DividerSchema } from "./object-types.js";
export { CrockfordULIDSchema, ISODateTimeSchema, RevisionSchema, ObjectIdSchema, ScreenIdSchema, SafeIdSchema, ChipSchema, CreatePatchInputSchema, UpdatePatchInputSchema, SendPatchesInputSchema, ResolvePatchInputSchema, PatchListQuerySchema, InterviewAnswerInputSchema };
export { InterviewQuestionCoreSchema, PendingInterviewQuestionSchema, InterviewAnswerSchema, AskUserInputSchema };
export { PrimitiveValueSchema, TokenValueSchema, SceneValueSchema, BaseObjectSchema, StateNameSchema, StateOverrideSchema, STATE_NAMES } from "./base-object.js";
export type { StateName, StateOverride } from "./base-object.js";
export { CheckboxSchema, RadioSchema, SwitchSchema, LinkSchema, ListSchema, ModalSchema, IconSchema, DividerSchema } from "./object-types.js";
export type { Chip } from "./primitives.js";
export type { InterviewQuestionCore, PendingInterviewQuestion, InterviewAnswer, AskUserInput } from "./interview.js";
export type { CreatePatchInput, UpdatePatchInput, SendPatchesInput, ResolvePatchInput } from "./studio-api.js";

export const ScreenSchema = BaseObjectSchema.extend({
  type: z.literal("screen"),
  parentId: z.null(),
  props: z.object({
    title: z.string().max(200).default("Untitled"),
    width: z.number().int().positive().default(1280),
    height: z.number().int().positive().default(720),
    background: SceneValueSchema.optional(),
  }).passthrough(),
});

export const ContainerSchema = BaseObjectSchema.extend({
  type: z.literal("container"),
  props: z.object({
    layout: z.enum(["flex", "grid", "absolute"]).default("flex"),
    direction: z.enum(["row", "column"]).optional(),
    gap: z.number().default(0),
    padding: z.number().default(0),
    align: z.enum(["start", "center", "end", "stretch"]).optional(),
    justify: z.enum(["start", "center", "end", "space-between", "space-around"]).optional(),
  }).passthrough(),
});

export const TextSchema = BaseObjectSchema.extend({
  type: z.literal("text"),
  props: z.object({
    content: z.string().max(2000).default(""),
    fontSize: z.number().default(16),
    fontWeight: z.union([z.number(), z.enum(["normal", "bold", "medium", "light"])]).default("normal"),
    color: SceneValueSchema.optional(),
    lineHeight: z.number().default(1.5),
    textAlign: z.enum(["left", "center", "right", "justify"]).default("left"),
  }).passthrough(),
});

export const ImageSchema = BaseObjectSchema.extend({
  type: z.literal("image"),
  props: z.object({
    src: z.string().url(),
    alt: z.string().max(500).default(""),
    fit: z.enum(["cover", "contain", "fill", "scale-down", "none"]).default("cover"),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }).passthrough(),
});

export const ButtonSchema = BaseObjectSchema.extend({
  type: z.literal("button"),
  props: z.object({
    label: z.string().max(200).default("Button"),
    variant: z.enum(["primary", "secondary", "outline", "ghost", "destructive"]).default("primary"),
    disabled: z.boolean().default(false),
    size: z.enum(["sm", "md", "lg"]).default("md"),
    onClick: z.string().max(1000).optional(),
  }).passthrough(),
});

export const InputSchema = BaseObjectSchema.extend({
  type: z.literal("input"),
  props: z.object({
    placeholder: z.string().max(500).default(""),
    value: z.string().max(2000).default(""),
    type: z.enum(["text", "email", "password", "number", "tel", "url"]).default("text"),
    disabled: z.boolean().default(false),
    required: z.boolean().default(false),
    onChange: z.string().max(1000).optional(),
  }).passthrough(),
});

export const SceneObjectSchema = z.union([
  ScreenSchema,
  ContainerSchema,
  TextSchema,
  ImageSchema,
  ButtonSchema,
  InputSchema,
  CheckboxSchema,
  RadioSchema,
  SwitchSchema,
  LinkSchema,
  ListSchema,
  ModalSchema,
  IconSchema,
  DividerSchema,
  BaseObjectSchema,
]);

export const SceneSchema = z.object({
  version: z.literal(1),
  revision: RevisionSchema,
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
  screens: z.record(ScreenIdSchema, ScreenSchema),
  objects: z.record(ObjectIdSchema, SceneObjectSchema),
  screenOrder: z.array(ScreenIdSchema).max(1000).default([]),
  metadata: z.object({
    name: z.string().default("Untitled Project"),
    description: z.string().optional(),
    tags: z.array(z.string()).max(50).default([]),
  }).default({ name: "Untitled Project", tags: [] }),
});

export type Scene = z.infer<typeof SceneSchema>;
export type SceneObject = z.infer<typeof SceneObjectSchema>;
export type Screen = z.infer<typeof ScreenSchema>;

export const PatchOpSchema = z.enum(["set", "unset", "add", "remove", "move", "setState"]);

export const PatchSchema = z.object({
  id: CrockfordULIDSchema,
  sceneId: SafeIdSchema,
  baseRevision: RevisionSchema,
  objectId: ObjectIdSchema,
  op: PatchOpSchema,
  path: z.string().min(1).max(512),
  value: SceneValueSchema.optional(),
  index: z.number().int().nonnegative().optional(),
  fromIndex: z.number().int().nonnegative().optional(),
  toParentId: ObjectIdSchema.optional(),
  createdAt: ISODateTimeSchema,
  status: z.enum(["draft", "sent", "applied", "rejected", "conflict"]).default("draft"),
  appliedAt: ISODateTimeSchema.nullable().default(null),
  conflictWith: CrockfordULIDSchema.nullable().default(null),
});

export type Patch = z.infer<typeof PatchSchema>;

export const LockSchema = z.object({
  objectId: ObjectIdSchema,
});

export type Lock = z.infer<typeof LockSchema>;

// Additive: owner metadata for object locks so a crashed writer can be reclaimed.
const LockOwnerSchema = z.object({ pid: z.number().int().positive(), ownerToken: z.string(), createdAt: z.number().int().nonnegative() });

export const LocksFileSchema = z.object({
  version: z.literal(1),
  lockedObjects: z.array(ObjectIdSchema).max(2000).default([]),
  updatedAt: ISODateTimeSchema,
  owners: z.record(z.string(), LockOwnerSchema).optional(),
});

export type LocksFile = z.infer<typeof LocksFileSchema>;

export const ConfigSchema = z.object({
  version: z.literal(1),
  projectName: z.string().default("Intent Project"),
  previewPort: z.number().int().min(1024).max(65535).default(3456),
  studioPort: z.number().int().min(1024).max(65535).default(3457),
  mcpPort: z.number().int().min(1024).max(65535).default(3458),
  maxBytes: z.number().int().positive().default(32768),
  autoSave: z.boolean().default(true),
  lockTTL: z.number().int().positive().default(30000),
  designProfile: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export const ProfileSchema = z.object({
  version: z.literal(1),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
  preferences: z.object({
    colorScheme: z.enum(["light", "dark", "system"]).default("system"),
    density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
    motion: z.enum(["none", "reduced", "full"]).default("reduced"),
    language: z.string().default("en"),
    tokens: z.record(z.string(), z.string()).default({}),
  }).default({ colorScheme: "system", density: "comfortable", motion: "reduced", language: "en", tokens: {} }),
  patterns: z.array(z.object({
    id: CrockfordULIDSchema,
    name: z.string().max(200),
    description: z.string().max(2000),
    objectTypes: z.array(z.string()).max(200),
    props: z.record(z.string(), SceneValueSchema),
    style: z.record(z.string(), SceneValueSchema),
    createdAt: ISODateTimeSchema,
    useCount: z.number().int().nonnegative().default(0),
  })).max(200).default([]),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const InterviewStateSchema = z.object({
  version: z.literal(1),
  status: z.enum(["not_started", "in_progress", "paused", "complete", "delegated"]),
  currentTopic: z.string().optional(),
  currentQuestionIndex: z.number().int().nonnegative().default(0),
  meter: z.number().min(0).max(100).default(0),
  meterTopics: z.record(z.string(), z.enum(["none", "partial", "covered"])).default({}),
  requiredTopics: z.array(z.string()).max(50).default([]),
  answeredTopics: z.array(z.string()).max(50).default([]),
  delegated: z.boolean().default(false),
  delegatedAt: ISODateTimeSchema.nullable().default(null),
  briefId: CrockfordULIDSchema.nullable().default(null),
  updatedAt: ISODateTimeSchema,
  pendingQuestion: PendingInterviewQuestionSchema.nullable().default(null),
  answers: z.array(InterviewAnswerSchema).max(200).default([]),
});

export type InterviewState = z.infer<typeof InterviewStateSchema>;

export const BriefSchema = z.object({
  id: CrockfordULIDSchema,
  version: z.literal(1),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
  title: z.string().default("Project Brief"),
  summary: z.string().default(""),
  goals: z.array(z.string()).max(50).default([]),
  constraints: z.array(z.string()).max(50).default([]),
  targetAudience: z.string().optional(),
  successMetrics: z.array(z.string()).max(50).default([]),
  designDirection: z.object({
    tone: z.string().optional(),
    palette: z.array(z.string()).max(50).default([]),
    typography: z.string().optional(),
    inspiration: z.array(z.string()).max(50).default([]),
  }).default({ palette: [], inspiration: [] }),
  technicalRequirements: z.array(z.string()).max(100).default([]),
  outOfScope: z.array(z.string()).max(50).default([]),
  approvalStatus: z.enum(["draft", "pending_review", "approved", "rejected"]).default("draft"),
  approvedAt: ISODateTimeSchema.nullable().default(null),
  approvedBy: z.string().nullable().default(null),
});

export type Brief = z.infer<typeof BriefSchema>;

export const FeedbackSchema = z.object({
  id: CrockfordULIDSchema,
  sceneId: SafeIdSchema,
  objectId: ObjectIdSchema,
  kind: z.enum(["visual", "behavior", "content", "layout", "accessibility", "other"]),
  message: z.string().min(1).max(2000),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["draft", "sent", "applied", "rejected", "conflict"]).default("draft"),
  chips: z.array(ChipSchema).max(7).default([]),
  baseRevision: RevisionSchema.nullable().default(null),
  createdAt: ISODateTimeSchema,
  sentAt: ISODateTimeSchema.nullable().default(null),
  appliedAt: ISODateTimeSchema.nullable().default(null),
  patchId: CrockfordULIDSchema.nullable().default(null),
  screenshot: z.string().optional(),
});

export type Feedback = z.infer<typeof FeedbackSchema>;
// Studio server API inputs (trd 11.3). Feedback drafts are created as patches in
// the current simplified model; chips are the quick-feedback set from design.md 4.3.
export const SceneSummarySchema = z.object({
  revision: RevisionSchema,
  screenCount: z.number().int().nonnegative(),
  objectCount: z.number().int().nonnegative(),
  screens: z.array(z.object({
    id: ScreenIdSchema,
    title: z.string().max(200),
    objectCount: z.number().int().nonnegative(),
  })).max(1000),
  lockedObjects: z.array(ObjectIdSchema).max(2000),
  pendingPatches: z.number().int().nonnegative(),
  updatedAt: ISODateTimeSchema,
});

export type SceneSummary = z.infer<typeof SceneSummarySchema>;

export const GetSceneInputSchema = z.object({
  objectIds: z.array(ObjectIdSchema).max(20).optional(),
  depth: z.number().int().min(0).max(4).default(2),
  includeLocks: z.boolean().default(true),
  maxBytes: z.number().int().positive().default(32768),
  sceneId: SafeIdSchema.default("default"),
});

export type GetSceneInput = z.infer<typeof GetSceneInputSchema>;

export const GetSceneOutputSchema = z.object({
  scene: SceneSchema.optional(),
  summary: SceneSummarySchema.optional(),
  objects: z.record(ObjectIdSchema, SceneObjectSchema).optional(),
  locks: z.array(LockSchema).max(2000).default([]),
  truncated: z.boolean().default(false),
  revision: RevisionSchema,
});

export type GetSceneOutput = z.infer<typeof GetSceneOutputSchema>;

export const ApplyPatchInputSchema = z.object({
  patch: PatchSchema,
});

export type ApplyPatchInput = z.infer<typeof ApplyPatchInputSchema>;

export const ApplyPatchOutputSchema = z.object({
  success: z.boolean(),
  revision: RevisionSchema,
  conflict: z.object({
    patchId: CrockfordULIDSchema,
    objectId: ObjectIdSchema,
    currentRevision: RevisionSchema,
    baseRevision: RevisionSchema,
  }).nullable().default(null),
  error: z.string().nullable().default(null),
  details: z.object({
    changedObjectIds: z.array(CrockfordULIDSchema).max(2000),
  }).optional(),
});

export type ApplyPatchOutput = z.infer<typeof ApplyPatchOutputSchema>;

export const GetFeedbackInputSchema = z.object({
  sceneId: SafeIdSchema,
  objectIds: z.array(ObjectIdSchema).max(50).optional(),
  includeImageData: z.boolean().default(false),
  since: ISODateTimeSchema.optional(),
});

export type GetFeedbackInput = z.infer<typeof GetFeedbackInputSchema>;

export const GetFeedbackOutputSchema = z.object({
  feedback: z.array(FeedbackSchema).max(2000),
  interviewAnswers: z.array(InterviewAnswerSchema).max(2000).default([]),
  locked: z.array(ObjectIdSchema).max(2000).default([]),
});

export type GetFeedbackOutput = z.infer<typeof GetFeedbackOutputSchema>;

export const OpenStudioInputSchema = z.object({
  sceneId: SafeIdSchema,
  userRequested: z.boolean(),
  quote: z.string().optional(),
});

export type OpenStudioInput = z.infer<typeof OpenStudioInputSchema>;

export const OpenStudioOutputSchema = z.object({
  url: z.string().url(),
  sessionId: z.string().min(1),
});

export type OpenStudioOutput = z.infer<typeof OpenStudioOutputSchema>;

export const ReadConfigInputSchema = z.object({
  keys: z.array(z.string()).max(2000).optional(),
});

export type ReadConfigInput = z.infer<typeof ReadConfigInputSchema>;

export const ReadConfigOutputSchema = z.object({
  config: ConfigSchema,
});

export type ReadConfigOutput = z.infer<typeof ReadConfigOutputSchema>;

// Port interfaces live in @intent/core (single source of truth). An earlier
// copy here was dead code with mismatched signatures — removed.

export function validateScene(data: unknown): Scene {
  return SceneSchema.parse(data);
}

export function validatePatch(data: unknown): Patch {
  return PatchSchema.parse(data);
}

export function validateConfig(data: unknown): Config {
  return ConfigSchema.parse(data);
}

export function validateProfile(data: unknown): Profile {
  return ProfileSchema.parse(data);
}

export function validateInterviewState(data: unknown): InterviewState {
  return InterviewStateSchema.parse(data);
}

export function validateBrief(data: unknown): Brief {
  return BriefSchema.parse(data);
}

export function validateFeedback(data: unknown): Feedback {
  return FeedbackSchema.parse(data);
}

export function validateGetSceneInput(data: unknown): GetSceneInput {
  return GetSceneInputSchema.parse(data);
}

export function validateApplyPatchInput(data: unknown): ApplyPatchInput {
  return ApplyPatchInputSchema.parse(data);
}

export function validateGetFeedbackInput(data: unknown): GetFeedbackInput {
  return GetFeedbackInputSchema.parse(data);
}

export function validateAskUserInput(data: unknown): AskUserInput {
  return AskUserInputSchema.parse(data);
}

export function validateOpenStudioInput(data: unknown): OpenStudioInput {
  return OpenStudioInputSchema.parse(data);
}

export function validateReadConfigInput(data: unknown): ReadConfigInput {
  return ReadConfigInputSchema.parse(data);
}

export const SCHEMA_VERSION = 1 as const;
export const SCENE_SCHEMA_VERSION = 1 as const;
export const CONFIG_SCHEMA_VERSION = 1 as const;
export const PROFILE_SCHEMA_VERSION = 1 as const;
export const INTERVIEW_SCHEMA_VERSION = 1 as const;
export const BRIEF_SCHEMA_VERSION = 1 as const;
export const FEEDBACK_SCHEMA_VERSION = 1 as const;