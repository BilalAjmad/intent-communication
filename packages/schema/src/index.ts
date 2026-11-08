import { z } from "zod";

export const UUIDv7Schema = z.string().uuid().refine(
  (val) => {
    const parts = val.split("-");
    if (parts.length !== 5) return false;
    const thirdPart = parts[2];
    if (!thirdPart) return false;
    const version = parseInt(thirdPart.charAt(0), 16);
    return version === 7;
  },
  { message: "Must be UUID v7" }
);

export const ISODateTimeSchema = z.string().datetime({ offset: true }).refine(
  (val) => val.endsWith("Z"),
  { message: "Must be UTC (end with Z)" }
);

export const RevisionSchema = z.number().int().nonnegative();

export const ObjectIdSchema = UUIDv7Schema;

export const ScreenIdSchema = UUIDv7Schema;

export const PrimitiveValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const TokenValueSchema = z.object({
  $type: z.literal("token"),
  $value: z.string(),
});

export const SceneValueSchema = z.union([
  PrimitiveValueSchema,
  TokenValueSchema,
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
]);

export const BaseObjectSchema = z.object({
  id: ObjectIdSchema,
  type: z.string().min(1),
  parentId: ObjectIdSchema.nullable(),
  children: z.array(ObjectIdSchema).default([]),
  props: z.record(z.string(), SceneValueSchema).default({}),
  style: z.record(z.string(), SceneValueSchema).default({}),
  meta: z.record(z.string(), z.unknown()).default({}),
});

export const ScreenSchema = BaseObjectSchema.extend({
  type: z.literal("screen"),
  parentId: z.null(),
  props: z.object({
    title: z.string().default("Untitled"),
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
    content: z.string().default(""),
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
    alt: z.string().default(""),
    fit: z.enum(["cover", "contain", "fill", "scale-down", "none"]).default("cover"),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  }).passthrough(),
});

export const ButtonSchema = BaseObjectSchema.extend({
  type: z.literal("button"),
  props: z.object({
    label: z.string().default("Button"),
    variant: z.enum(["primary", "secondary", "outline", "ghost", "destructive"]).default("primary"),
    disabled: z.boolean().default(false),
    size: z.enum(["sm", "md", "lg"]).default("md"),
    onClick: z.string().optional(),
  }).passthrough(),
});

export const InputSchema = BaseObjectSchema.extend({
  type: z.literal("input"),
  props: z.object({
    placeholder: z.string().default(""),
    value: z.string().default(""),
    type: z.enum(["text", "email", "password", "number", "tel", "url"]).default("text"),
    disabled: z.boolean().default(false),
    required: z.boolean().default(false),
    onChange: z.string().optional(),
  }).passthrough(),
});

export const SceneObjectSchema = z.union([
  ScreenSchema,
  ContainerSchema,
  TextSchema,
  ImageSchema,
  ButtonSchema,
  InputSchema,
  BaseObjectSchema,
]);

export const SceneSchema = z.object({
  version: z.literal(1),
  revision: RevisionSchema,
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
  screens: z.record(ScreenIdSchema, ScreenSchema),
  objects: z.record(ObjectIdSchema, SceneObjectSchema),
  screenOrder: z.array(ScreenIdSchema).default([]),
  metadata: z.object({
    name: z.string().default("Untitled Project"),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }).default({}),
});

export type Scene = z.infer<typeof SceneSchema>;
export type SceneObject = z.infer<typeof SceneObjectSchema>;
export type Screen = z.infer<typeof ScreenSchema>;

export const PatchOpSchema = z.enum(["set", "unset", "insert", "remove", "move", "replace"]);

export const PatchSchema = z.object({
  id: UUIDv7Schema,
  sceneId: UUIDv7Schema,
  baseRevision: RevisionSchema,
  objectId: ObjectIdSchema,
  op: PatchOpSchema,
  path: z.string().min(1),
  value: SceneValueSchema.optional(),
  index: z.number().int().nonnegative().optional(),
  fromIndex: z.number().int().nonnegative().optional(),
  toParentId: ObjectIdSchema.optional(),
  createdAt: ISODateTimeSchema,
  status: z.enum(["pending", "applied", "rejected", "conflict"]).default("pending"),
  appliedAt: ISODateTimeSchema.nullable().default(null),
  conflictWith: UUIDv7Schema.nullable().default(null),
});

export type Patch = z.infer<typeof PatchSchema>;

export const LockSchema = z.object({
  objectId: ObjectIdSchema,
});

export type Lock = z.infer<typeof LockSchema>;

export const LocksFileSchema = z.object({
  version: z.literal(1),
  lockedObjects: z.array(ObjectIdSchema).default([]),
  updatedAt: ISODateTimeSchema,
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
  }).default({}),
  patterns: z.array(z.object({
    id: UUIDv7Schema,
    name: z.string(),
    description: z.string(),
    objectTypes: z.array(z.string()),
    props: z.record(z.string(), SceneValueSchema),
    style: z.record(z.string(), SceneValueSchema),
    createdAt: ISODateTimeSchema,
    useCount: z.number().int().nonnegative().default(0),
  })).default([]),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const InterviewStateSchema = z.object({
  version: z.literal(1),
  status: z.enum(["not_started", "in_progress", "paused", "complete", "delegated"]),
  currentTopic: z.string().optional(),
  currentQuestionIndex: z.number().int().nonnegative().default(0),
  meter: z.number().min(0).max(100).default(0),
  requiredTopics: z.array(z.string()).default([]),
  answeredTopics: z.array(z.string()).default([]),
  delegated: z.boolean().default(false),
  delegatedAt: ISODateTimeSchema.nullable().default(null),
  briefId: UUIDv7Schema.nullable().default(null),
  updatedAt: ISODateTimeSchema,
});

export type InterviewState = z.infer<typeof InterviewStateSchema>;

export const BriefSchema = z.object({
  id: UUIDv7Schema,
  version: z.literal(1),
  createdAt: ISODateTimeSchema,
  updatedAt: ISODateTimeSchema,
  title: z.string().default("Project Brief"),
  summary: z.string().default(""),
  goals: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  targetAudience: z.string().optional(),
  successMetrics: z.array(z.string()).default([]),
  designDirection: z.object({
    tone: z.string().optional(),
    palette: z.array(z.string()).default([]),
    typography: z.string().optional(),
    inspiration: z.array(z.string()).default([]),
  }).default({}),
  technicalRequirements: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  approvalStatus: z.enum(["draft", "pending_review", "approved", "rejected"]).default("draft"),
  approvedAt: ISODateTimeSchema.nullable().default(null),
  approvedBy: z.string().nullable().default(null),
});

export type Brief = z.infer<typeof BriefSchema>;

export const FeedbackSchema = z.object({
  id: UUIDv7Schema,
  sceneId: UUIDv7Schema,
  objectId: ObjectIdSchema,
  kind: z.enum(["visual", "behavior", "content", "layout", "accessibility", "other"]),
  message: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["sent", "acknowledged", "applied", "rejected", "deferred"]).default("sent"),
  createdAt: ISODateTimeSchema,
  acknowledgedAt: ISODateTimeSchema.nullable().default(null),
  appliedAt: ISODateTimeSchema.nullable().default(null),
  patchId: UUIDv7Schema.nullable().default(null),
  screenshot: z.string().optional(),
});

export type Feedback = z.infer<typeof FeedbackSchema>;

export const SceneSummarySchema = z.object({
  revision: RevisionSchema,
  screenCount: z.number().int().nonnegative(),
  objectCount: z.number().int().nonnegative(),
  screens: z.array(z.object({
    id: ScreenIdSchema,
    title: z.string(),
    objectCount: z.number().int().nonnegative(),
  })),
  lockedObjects: z.array(ObjectIdSchema),
  pendingPatches: z.number().int().nonnegative(),
  updatedAt: ISODateTimeSchema,
});

export type SceneSummary = z.infer<typeof SceneSummarySchema>;

export const GetSceneInputSchema = z.object({
  objectIds: z.array(ObjectIdSchema).max(20).optional(),
  depth: z.number().int().min(0).max(4).default(2),
  includeLocks: z.boolean().default(true),
  maxBytes: z.number().int().positive().default(32768),
});

export type GetSceneInput = z.infer<typeof GetSceneInputSchema>;

export const GetSceneOutputSchema = z.object({
  scene: SceneSchema.optional(),
  summary: SceneSummarySchema.optional(),
  objects: z.record(ObjectIdSchema, SceneObjectSchema).optional(),
  locks: z.array(LockSchema).default([]),
  truncated: z.boolean().default(false),
  revision: RevisionSchema,
});

export type GetSceneOutput = z.infer<typeof GetSceneOutputSchema>;

export const ApplyPatchInputSchema = z.object({
  patch: PatchSchema,
  force: z.boolean().default(false),
});

export type ApplyPatchInput = z.infer<typeof ApplyPatchInputSchema>;

export const ApplyPatchOutputSchema = z.object({
  success: z.boolean(),
  revision: RevisionSchema,
  conflict: z.object({
    patchId: UUIDv7Schema,
    objectId: ObjectIdSchema,
    currentRevision: RevisionSchema,
    baseRevision: RevisionSchema,
  }).nullable().default(null),
  error: z.string().nullable().default(null),
});

export type ApplyPatchOutput = z.infer<typeof ApplyPatchOutputSchema>;

export const GetFeedbackInputSchema = z.object({
  sceneId: UUIDv7Schema,
  objectIds: z.array(ObjectIdSchema).optional(),
  includeImageData: z.boolean().default(false),
  since: ISODateTimeSchema.optional(),
});

export type GetFeedbackInput = z.infer<typeof GetFeedbackInputSchema>;

export const GetFeedbackOutputSchema = z.object({
  feedback: z.array(FeedbackSchema),
});

export type GetFeedbackOutput = z.infer<typeof GetFeedbackOutputSchema>;

export const AskUserInputSchema = z.object({
  questionId: z.string().min(1),
  kind: z.enum(["start", "choice", "text", "scale", "confirm", "skip"]),
  prompt: z.string().min(1),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  previousAnswer: z.unknown().optional(),
  requiredTopics: z.array(z.string()).optional(),
});

export type AskUserInput = z.infer<typeof AskUserInputSchema>;

export const AskUserOutputSchema = z.object({
  answer: z.unknown(),
  meter: z.number().min(0).max(100),
  nextQuestion: AskUserInputSchema.nullable().default(null),
  briefId: UUIDv7Schema.nullable().default(null),
  delegated: z.boolean().default(false),
});

export type AskUserOutput = z.infer<typeof AskUserOutputSchema>;

export const OpenStudioInputSchema = z.object({
  sceneId: UUIDv7Schema,
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
  keys: z.array(z.string()).optional(),
});

export type ReadConfigInput = z.infer<typeof ReadConfigInputSchema>;

export const ReadConfigOutputSchema = z.object({
  config: ConfigSchema,
});

export type ReadConfigOutput = z.infer<typeof ReadConfigOutputSchema>;

export const StoragePort = {
  readScene: (_sceneId: string) => Promise<Scene | null>,
  writeScene: (_sceneId: string, _scene: Scene) => Promise<void>,
  readLocks: (_sceneId: string) => Promise<LocksFile>,
  writeLocks: (_sceneId: string, _locks: LocksFile) => Promise<void>,
  readConfig: (_projectRoot: string) => Promise<Config>,
  writeConfig: (_projectRoot: string, _config: Config) => Promise<void>,
  readProfile: (_projectRoot: string) => Promise<Profile | null>,
  writeProfile: (_projectRoot: string, _profile: Profile) => Promise<void>,
  readInterviewState: (_projectRoot: string) => Promise<InterviewState | null>,
  writeInterviewState: (_projectRoot: string, _state: InterviewState) => Promise<void>,
  readBrief: (_projectRoot: string, _briefId: string) => Promise<Brief | null>,
  writeBrief: (_projectRoot: string, _brief: Brief) => Promise<void>,
  readFeedback: (_sceneId: string) => Promise<Feedback[]>,
  writeFeedback: (_sceneId: string, _feedback: Feedback[]) => Promise<void>,
  listScenes: (_projectRoot: string) => Promise<string[]>,
};

export const LockPort = {
  acquire: (_sceneId: string, _objectId: string) => Promise<boolean>,
  release: (_sceneId: string, _objectId: string) => Promise<boolean>,
  isLocked: (_sceneId: string, _objectId: string) => Promise<boolean>,
  getLockedObjects: (_sceneId: string) => Promise<string[]>,
};

export const CryptoPort = {
  generateId: (): string => "",
  hash: (_input: string): Promise<string> => Promise.resolve(""),
  verify: (_input: string, _hash: string): Promise<boolean> => Promise.resolve(false),
};

export type StoragePort = typeof StoragePort;
export type LockPort = typeof LockPort;
export type CryptoPort = typeof CryptoPort;

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