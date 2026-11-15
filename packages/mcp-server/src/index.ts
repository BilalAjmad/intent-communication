import {
  StoragePort,
  LockPort,
  CryptoPort,
  IntentError,
  ErrorCodes,
  writePipeline,
} from "@intent/core";
import {
  Scene,
  Feedback,
  validateScene,
  validatePatch,
  validateConfig,
  validateProfile,
  validateInterviewState,
  validateBrief,
  validateFeedback,
  GetSceneInputSchema,
  ApplyPatchInputSchema,
  GetFeedbackInputSchema,
  AskUserInputSchema,
  OpenStudioInputSchema,
} from "@intent/schema";
import { createFileStoragePort, createFileLockPort, createNodeCryptoPort } from "@intent/adapters-node";
import { lockedWithDescendantsLocal, freshInterviewState, dedupe, renderPlainTextCard, applyMeterUpdate, meterWithRequiredTopicCap } from "./helpers.js";

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: unknown;
  handler: (input: unknown, context: MCPContext) => Promise<unknown>;
}

export interface MCPContext {
  projectRoot: string;
  storage: StoragePort;
  lockPort: LockPort;
  crypto: CryptoPort;
  /** Optional event hook (e.g. the HTTP layer broadcasts patch.changed to SSE clients). */
  notify?: (event: string, payload: unknown) => void;
}

export function createMCPContext(projectRoot: string): MCPContext {
  const storage = createFileStoragePort(projectRoot);
  const lockPort = createFileLockPort(projectRoot);
  const crypto = createNodeCryptoPort();
  return { projectRoot, storage, lockPort, crypto };
}

function truncateToBytes(obj: unknown, maxBytes: number): { data: unknown; truncated: boolean } {
  const str = JSON.stringify(obj);
  if (Buffer.byteLength(str, "utf-8") <= maxBytes) {
    return { data: obj, truncated: false };
  }
  const truncatedStr = str.slice(0, maxBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(truncatedStr);
  } catch {
    parsed = { _truncated: true, message: "Response truncated" };
  }
  return { data: parsed, truncated: true };
}

export const getSceneTool: MCPTool = {
  name: "get_scene",
  description: "Get a scene or scene summary with optional object filtering",
  inputSchema: GetSceneInputSchema,
  async handler(input: unknown, context: MCPContext) {
    const validated = GetSceneInputSchema.parse(input);
    let scene: Scene | null = null;
    let summary: unknown = null;
    const objects: Record<string, unknown> = {};
    let locks: string[] = [];

    if (validated.objectIds && validated.objectIds.length > 0) {
      const fullScene = await context.storage.readScene(validated.sceneId);
      if (!fullScene) {
        throw new IntentError(ErrorCodes.E_NOT_FOUND, "Scene not found");
      }
      scene = fullScene;
      for (const id of validated.objectIds) {
        if (scene.objects[id]) {
          objects[id] = scene.objects[id];
        }
      }
      locks = await context.lockPort.getLockedObjects(validated.sceneId);
    } else {
      const fullScene = await context.storage.readScene(validated.sceneId);
      if (!fullScene) {
        throw new IntentError(ErrorCodes.E_NOT_FOUND, "Scene not found");
      }
      scene = fullScene;
      summary = {
        revision: scene.revision,
        screenCount: Object.keys(scene.screens).length,
        objectCount: Object.keys(scene.objects).length,
        screens: Object.values(scene.screens).map((s) => ({
          id: s.id,
          title: s.props.title,
          objectCount: s.children.length,
        })),
        lockedObjects: locks,
        pendingPatches: 0,
        updatedAt: scene.updatedAt,
      };
      locks = await context.lockPort.getLockedObjects(validated.sceneId);
    }

    const result = {
      scene,
      summary,
      objects: Object.keys(objects).length > 0 ? objects : undefined,
      locks,
      truncated: false,
      revision: scene?.revision ?? 0,
    };

    const { data, truncated } = truncateToBytes(result, validated.maxBytes ?? 32768);
    return { ...(data as Record<string, unknown>), truncated };
  },
};

export const applyPatchTool: MCPTool = {
  name: "apply_patch",
  description: "Apply a patch to a scene",
  inputSchema: ApplyPatchInputSchema,
  async handler(input: unknown, context: MCPContext) {
    const validated = ApplyPatchInputSchema.parse(input);
    const { patch } = validated;

    const scene = await context.storage.readScene(patch.sceneId);
    if (!scene) {
      throw new IntentError(ErrorCodes.E_NOT_FOUND, "Scene not found");
    }

    const vp = validatePatch(patch);
    const lock = await context.lockPort.isLocked(patch.sceneId, vp.objectId);
    if (lock) {
      return {
        success: false,
        revision: scene.revision,
        conflict: {
          patchId: vp.id,
          objectId: vp.objectId,
          currentRevision: scene.revision,
          baseRevision: vp.baseRevision,
        },
        error: ErrorCodes.E_LOCKED,
      };
    }

    const result = await writePipeline(context.storage, context.lockPort, patch.sceneId, [vp]);
    // trd 6.4 status transitions: a successful apply marks the oldest matching
    // sent feedback as applied; an E_CONFLICT marks it conflict. The agent does not
    // pass a feedback id, so the target is the patched object, sent first.
    if (result && typeof result === "object" && "success" in result) {
      const r = result as { success: boolean; error?: string };
      if (r.success || r.error === ErrorCodes.E_CONFLICT) {
        const newStatus = r.success ? ("applied" as const) : ("conflict" as const);
        const feedback = await context.storage.readFeedback(patch.sceneId);
        const idx = feedback.findIndex((f) => f.status === "sent" && f.objectId === vp.objectId);
        if (idx !== -1) {
          const item = feedback[idx] as Feedback;
          feedback[idx] = {
            ...item,
            status: newStatus,
            appliedAt: r.success ? new Date().toISOString() : item.appliedAt,
            patchId: r.success ? vp.id : item.patchId,
          };
          await context.storage.writeFeedback(patch.sceneId, feedback);
          context.notify?.("patch.changed", { id: item.id, status: newStatus, sceneId: patch.sceneId });
        }
      }
    }
    return result;
  },
};

export const getFeedbackTool: MCPTool = {
  name: "get_feedback",
  description: "Get feedback for a scene",
  inputSchema: GetFeedbackInputSchema,
  async handler(input: unknown, context: MCPContext) {
    const validated = GetFeedbackInputSchema.parse(input);
    const allFeedback = await context.storage.readFeedback(validated.sceneId);
    // Drafts are on disk but invisible to agents until the user sends them (trd 6.1/6.4).
    let feedback = allFeedback.filter((f) => f.status !== "draft");
    if (validated.objectIds) {
      feedback = feedback.filter((f) => validated.objectIds!.includes(f.objectId));
    }
    const since = validated.since;
    if (since) {
      feedback = feedback.filter((f) => f.createdAt >= since);
    }
    if (!validated.includeImageData) {
      feedback = feedback.map((f) => ({ ...f, screenshot: undefined }));
    }

    // Effective locked set: objects locked directly + descendants of locked containers.
    const scene = await context.storage.readScene(validated.sceneId);
    const lockedRaw = await context.lockPort.getLockedObjects(validated.sceneId);
    const locked = lockedWithDescendantsLocal(scene, lockedRaw);

    // Interview answers: unconsumed Studio/Chat answers, Studio wins on the same questionId
    // (TC-INT-17), each returned exactly once, then marked consumed (trd 10.4).
    const interviewState = await context.storage.readInterviewState();
    let interviewAnswers: { questionId: string; answer: unknown; via: "studio" | "chat"; answeredAt: string }[] = [];
    if (interviewState && interviewState.answers.length > 0) {
      const unconsumed = interviewState.answers.filter((a) => !a.consumed);
      const byQuestion = new Map<string, (typeof unconsumed)[number]>();
      for (const a of unconsumed) {
        const existing = byQuestion.get(a.questionId);
        if (!existing || (existing.via === "chat" && a.via === "studio")) {
          byQuestion.set(a.questionId, a);
        }
      }
      interviewAnswers = Array.from(byQuestion.values()).map((a) => ({
        questionId: a.questionId,
        answer: a.answer,
        via: a.via,
        answeredAt: a.answeredAt,
      }));
      interviewState.answers = interviewState.answers.map((a) => ({ ...a, consumed: true }));
      interviewState.updatedAt = new Date().toISOString();
      await context.storage.writeInterviewState(interviewState);
    }

    return { feedback, interviewAnswers, locked };
  },
};

export const askUserTool: MCPTool = {
  name: "ask_user",
  description: "Ask the user a question during interview",
  inputSchema: AskUserInputSchema,
  async handler(input: unknown, context: MCPContext) {
    const validated = AskUserInputSchema.parse(input);
    const now = new Date().toISOString();
    let state = await context.storage.readInterviewState();
    if (!state) {
      state = freshInterviewState();
    }

    // 1) A previous answer (chat, passed via previousAnswer) is recorded — unless a
    //    Studio answer for the same questionId exists, in which case the Studio answer wins (TC-INT-17).
    let note: string | undefined;
    let recordedQuestionId: string | undefined;
    const pa = validated.previousAnswer;
    const paId =
      pa && typeof pa === "object" && typeof (pa as { questionId?: unknown }).questionId === "string"
        ? String((pa as { questionId: unknown }).questionId)
        : undefined;
    if (pa && paId && paId.length > 0 && "answer" in (pa as object)) {
      const paAnswer = (pa as { answer: unknown }).answer;
      const studioAnswer = state.answers.find((a) => a.questionId === paId && a.via === "studio");
      if (studioAnswer) {
        note = `Studio answer already recorded for ${paId}; chat answer ignored.`;
      } else {
        state.answers.push({
          questionId: paId,
          answer: paAnswer,
          via: "chat",
          answeredAt: now,
          consumed: false,
        });
        recordedQuestionId = paId;
        if (state.pendingQuestion?.questionId === paId) {
          state.pendingQuestion = null;
        }
        state.status = "in_progress";
        state.answeredTopics = dedupe([...state.answeredTopics, ...(validated.requiredTopics ?? [])]);
        state.updatedAt = now;
      }
    }

    // 2) Merge required topics + meter update from the caller
    state.requiredTopics = dedupe([...state.requiredTopics, ...(validated.requiredTopics ?? [])]);
    applyMeterUpdate(state, validated.meter);
    const { percent, capped, reason } = meterWithRequiredTopicCap(
      state.meter,
      state.requiredTopics,
      state.meterTopics,
    );
    state.meter = percent;

    // 3) Persist pending question (summary questions included) so the Studio Interview tab can render it
    const pendingQuestion = { questionId: validated.questionId, kind: validated.kind, prompt: validated.prompt,
      options: validated.options, min: validated.min, max: validated.max, step: validated.step,
      topic: validated.topic, round: validated.round, questionNumber: validated.questionNumber,
      estimatedTotal: validated.estimatedTotal, whyAsked: validated.whyAsked,
      requiredTopics: validated.requiredTopics, summary: validated.summary, askedAt: now };
    state.pendingQuestion = pendingQuestion;
    if (state.status !== "complete") {
      state.status = "in_progress";
      state.currentQuestionIndex =
        typeof validated.questionNumber === "number" ? Math.max(0, validated.questionNumber - 1) : state.currentQuestionIndex;
    }
    state.updatedAt = now;
    await context.storage.writeInterviewState(state);

    const config = await context.storage.readConfig();
    const renderedText = renderPlainTextCard(validated, state.meter);
    context.notify?.("interview.changed", { status: state.status });
    return {
      questionId: validated.questionId,
      renderedText,
      studio: { open: true, url: `http://localhost:${config.studioPort}?scene=default` },
      meterApplied: { percent: state.meter, capped, ...(reason ? { reason } : {}) },
      budget: { asked: state.currentQuestionIndex + 1, softCap: 25, over: false },
      delegated: state.delegated,
      ...(note ? { note } : {}),
      ...(recordedQuestionId ? { recorded: { previousQuestionId: recordedQuestionId } } : {}),
    };
  },
};

export const openStudioTool: MCPTool = {
  name: "open_studio",
  description: "Open the Prototype Studio for a scene",
  inputSchema: OpenStudioInputSchema,
  async handler(input: unknown, context: MCPContext) {
    const validated = OpenStudioInputSchema.parse(input);
    const config = await context.storage.readConfig();
    const baseUrl = `http://localhost:${config.studioPort}`;
    return {
      url: `${baseUrl}?scene=${validated.sceneId}`,
      sessionId: `studio-${Date.now()}`,
    };
  },
};

export const validateTool: MCPTool = {
  name: "validate",
  description: "Validate scene, patch, config, profile, interview state, brief, or feedback data",
  inputSchema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["scene", "patch", "config", "profile", "interviewState", "brief", "feedback"],
      },
      data: { type: "object" },
    },
    required: ["type", "data"],
  },
  async handler(input: unknown, _context: MCPContext) {
    const { type, data } = input as { type: string; data: unknown };
    try {
      switch (type) {
        case "scene":
          validateScene(data);
          break;
        case "patch":
          validatePatch(data);
          break;
        case "config":
          validateConfig(data);
          break;
        case "profile":
          validateProfile(data);
          break;
        case "interviewState":
          validateInterviewState(data);
          break;
        case "brief":
          validateBrief(data);
          break;
        case "feedback":
          validateFeedback(data);
          break;
        default:
          throw new IntentError(ErrorCodes.E_INVALID_PATCH, `Unknown validate type: ${type}`);
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  },
};

export const MCP_TOOLS: MCPTool[] = [
  getSceneTool,
  applyPatchTool,
  getFeedbackTool,
  askUserTool,
  openStudioTool,
  validateTool,
];

export function getMCPTool(name: string): MCPTool | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}

// Structural ZodError detection (zod is not a direct dependency of this package).
// trd 18.2: invalid input surfaces as E_SCHEMA with the issue path.
interface ZodIssueLike {
  path?: (string | number)[];
  message?: string;
}
function zodToIntentError(err: unknown): IntentError | null {
  if (err instanceof Error && err.name === "ZodError" && Array.isArray((err as { issues?: unknown }).issues)) {
    const issues = (err as unknown as { issues: ZodIssueLike[] }).issues;
    const first = issues[0];
    const where = first?.path?.length ? ` at ${first.path.join(".")}` : "";
    return new IntentError(ErrorCodes.E_SCHEMA, `Invalid input${where}: ${first?.message ?? "schema validation failed"}`);
  }
  return null;
}

export async function handleMCPRequest(
  toolName: string,
  input: unknown,
  context: MCPContext
): Promise<unknown> {
  const tool = getMCPTool(toolName);
  if (!tool) {
    throw new IntentError(ErrorCodes.E_NOT_FOUND, `Tool ${toolName} not found`);
  }
  try {
    return await tool.handler(input, context);
  } catch (err) {
    const ze = zodToIntentError(err);
    if (ze) throw ze;
    throw err;
  }
}

export { IntentError, ErrorCodes };