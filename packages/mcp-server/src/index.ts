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
    return { feedback };
  },
};

export const askUserTool: MCPTool = {
  name: "ask_user",
  description: "Ask the user a question during interview",
  inputSchema: AskUserInputSchema,
  async handler(input: unknown, _context: MCPContext) {
    const validated = AskUserInputSchema.parse(input);
    return {
      answer: null,
      meter: 0,
      nextQuestion: validated,
      briefId: null,
      delegated: false,
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