import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Scene,
  Patch,
  Lock,
  LocksFile,
  Config,
  Profile,
  InterviewState,
  Brief,
  Feedback,
  SceneObject,
  validateScene,
  validatePatch,
  UUIDv7Schema,
  ISODateTimeSchema,
  RevisionSchema,
  SCHEMA_VERSION,
  SCENE_SCHEMA_VERSION,
} from "@intent/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface WriteResult {
  success: boolean;
  revision: number;
  error?: string;
}

export interface NormalizeResult {
  scene: Scene;
  patches: Patch[];
}

export interface StoragePort {
  readScene(sceneId: string): Promise<Scene | null>;
  writeScene(sceneId: string, scene: Scene): Promise<void>;
  readLocks(sceneId: string): Promise<LocksFile>;
  writeLocks(sceneId: string, locksFile: LocksFile): Promise<void>;
  readConfig(): Promise<Config>;
  writeConfig(config: Config): Promise<void>;
  readProfile(): Promise<Profile | null>;
  writeProfile(profile: Profile): Promise<void>;
  readInterviewState(): Promise<InterviewState | null>;
  writeInterviewState(state: InterviewState): Promise<void>;
  readBrief(briefId: string): Promise<Brief | null>;
  writeBrief(brief: Brief): Promise<void>;
  readFeedback(sceneId: string): Promise<Feedback[]>;
  writeFeedback(sceneId: string, feedback: Feedback[]): Promise<void>;
  listScenes(): Promise<string[]>;
}

export interface LockPort {
  acquire(sceneId: string, objectId: string): Promise<boolean>;
  release(sceneId: string, objectId: string): Promise<boolean>;
  isLocked(sceneId: string, objectId: string): Promise<boolean>;
  getLockedObjects(sceneId: string): Promise<string[]>;
}

export interface CryptoPort {
  generateId(): string;
  hash(input: string): Promise<string>;
  verify(input: string, hash: string): Promise<boolean>;
}

export class IntentError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "IntentError";
  }
}

export const ErrorCodes = {
  E_NOT_FOUND: "E_NOT_FOUND",
  E_CONFLICT: "E_CONFLICT",
  E_LOCKED: "E_LOCKED",
  E_INVALID_PATCH: "E_INVALID_PATCH",
  E_INVALID_SCENE: "E_INVALID_SCENE",
  E_STORAGE: "E_STORAGE",
  E_PERMISSION: "E_PERMISSION",
  E_SYMLINK: "E_SYMLINK",
  E_PATH_TRAVERSAL: "E_PATH_TRAVERSAL",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export function isIntentError(err: unknown): err is IntentError {
  return err instanceof IntentError;
}

export function createStoragePort(projectRoot: string): StoragePort {
  const intentDir = resolve(projectRoot, ".intent");
  const scenesDir = resolve(intentDir, "scenes");
  const locksDir = resolve(intentDir, "locks");
  const configPath = resolve(intentDir, "config.json");
  const profilePath = resolve(intentDir, "profile.json");
  const interviewPath = resolve(intentDir, "interview", "state.json");
  const briefsDir = resolve(intentDir, "briefs");
  const feedbackDir = resolve(intentDir, "feedback");

  async function ensureDirs() {
    await fs.mkdir(scenesDir, { recursive: true });
    await fs.mkdir(locksDir, { recursive: true });
    await fs.mkdir(briefsDir, { recursive: true });
    await fs.mkdir(feedbackDir, { recursive: true });
    await fs.mkdir(dirname(interviewPath), { recursive: true });
  }

  async function checkPathSafety(targetPath: string, basePath: string) {
    const resolved = resolve(targetPath);
    const resolvedBase = resolve(basePath);
    if (!resolved.startsWith(resolvedBase)) {
      throw new IntentError(ErrorCodes.E_PATH_TRAVERSAL, "Path traversal attempt detected");
    }
    try {
      const stats = await fs.lstat(resolved);
      if (stats.isSymbolicLink()) {
        throw new IntentError(ErrorCodes.E_SYMLINK, "Symlinks not allowed");
      }
    } catch {
    }
  }

  return {
    async readScene(sceneId: string): Promise<Scene | null> {
      await ensureDirs();
      const scenePath = resolve(scenesDir, `${sceneId}.json`);
      await checkPathSafety(scenePath, scenesDir);
      try {
        const content = await fs.readFile(scenePath, "utf-8");
        return validateScene(JSON.parse(content));
      } catch {
        return null;
      }
    },

    async writeScene(sceneId: string, scene: Scene): Promise<void> {
      await ensureDirs();
      const scenePath = resolve(scenesDir, `${sceneId}.json`);
      await checkPathSafety(scenePath, scenesDir);
      const validated = validateScene(scene);
      const tmpPath = `${scenePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(validated, null, 0), "utf-8");
      await fs.rename(tmpPath, scenePath);
    },

    async readLocks(sceneId: string): Promise<LocksFile> {
      await ensureDirs();
      const locksPath = resolve(locksDir, `${sceneId}.locks.json`);
      await checkPathSafety(locksPath, locksDir);
      try {
        const content = await fs.readFile(locksPath, "utf-8");
        const data = JSON.parse(content);
        return {
          version: data.version ?? 1,
          lockedObjects: data.lockedObjects ?? [],
          updatedAt: data.updatedAt ?? new Date().toISOString(),
        };
      } catch {
        return {
          version: 1,
          lockedObjects: [],
          updatedAt: new Date().toISOString(),
        };
      }
    },

    async writeLocks(sceneId: string, locksFile: LocksFile): Promise<void> {
      await ensureDirs();
      const locksPath = resolve(locksDir, `${sceneId}.locks.json`);
      await checkPathSafety(locksPath, locksDir);
      const tmpPath = `${locksPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(locksFile, null, 0), "utf-8");
      await fs.rename(tmpPath, locksPath);
    },

    async readConfig(): Promise<Config> {
      await ensureDirs();
      try {
        const content = await fs.readFile(configPath, "utf-8");
        return JSON.parse(content);
      } catch {
        return {
          version: 1,
          projectName: "Intent Project",
          previewPort: 3456,
          studioPort: 3457,
          mcpPort: 3458,
          maxBytes: 32768,
          autoSave: true,
          lockTTL: 30000,
        };
      }
    },

    async writeConfig(config: Config): Promise<void> {
      await ensureDirs();
      await checkPathSafety(configPath, intentDir);
      const tmpPath = `${configPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(config, null, 0), "utf-8");
      await fs.rename(tmpPath, configPath);
    },

    async readProfile(): Promise<Profile | null> {
      await ensureDirs();
      try {
        const content = await fs.readFile(profilePath, "utf-8");
        return JSON.parse(content);
      } catch {
        return null;
      }
    },

    async writeProfile(profile: Profile): Promise<void> {
      await ensureDirs();
      await checkPathSafety(profilePath, intentDir);
      const tmpPath = `${profilePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(profile, null, 0), "utf-8");
      await fs.rename(tmpPath, profilePath);
    },

    async readInterviewState(): Promise<InterviewState | null> {
      await ensureDirs();
      try {
        const content = await fs.readFile(interviewPath, "utf-8");
        return JSON.parse(content);
      } catch {
        return null;
      }
    },

    async writeInterviewState(state: InterviewState): Promise<void> {
      await ensureDirs();
      await checkPathSafety(interviewPath, intentDir);
      const tmpPath = `${interviewPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(state, null, 0), "utf-8");
      await fs.rename(tmpPath, interviewPath);
    },

    async readBrief(briefId: string): Promise<Brief | null> {
      await ensureDirs();
      const briefPath = resolve(briefsDir, `${briefId}.json`);
      await checkPathSafety(briefPath, briefsDir);
      try {
        const content = await fs.readFile(briefPath, "utf-8");
        return JSON.parse(content);
      } catch {
        return null;
      }
    },

    async writeBrief(brief: Brief): Promise<void> {
      await ensureDirs();
      const briefPath = resolve(briefsDir, `${brief.id}.json`);
      await checkPathSafety(briefPath, briefsDir);
      const tmpPath = `${briefPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(brief, null, 0), "utf-8");
      await fs.rename(tmpPath, briefPath);
    },

    async readFeedback(sceneId: string): Promise<Feedback[]> {
      await ensureDirs();
      const feedbackPath = resolve(feedbackDir, `${sceneId}.json`);
      await checkPathSafety(feedbackPath, feedbackDir);
      try {
        const content = await fs.readFile(feedbackPath, "utf-8");
        return JSON.parse(content);
      } catch {
        return [];
      }
    },

    async writeFeedback(sceneId: string, feedback: Feedback[]): Promise<void> {
      await ensureDirs();
      const feedbackPath = resolve(feedbackDir, `${sceneId}.json`);
      await checkPathSafety(feedbackPath, feedbackDir);
      const tmpPath = `${feedbackPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(feedback, null, 0), "utf-8");
      await fs.rename(tmpPath, feedbackPath);
    },

    async listScenes(): Promise<string[]> {
      await ensureDirs();
      try {
        const entries = await fs.readdir(scenesDir);
        return entries
          .filter((e: string) => e.endsWith(".json"))
          .map((e: string) => e.slice(0, -5));
      } catch {
        return [];
      }
    },
  };
}

export function createLockPort(storage: StoragePort): LockPort {
  return {
    async acquire(sceneId: string, objectId: string): Promise<boolean> {
      const locksFile = await storage.readLocks(sceneId);
      if (locksFile.lockedObjects.includes(objectId)) {
        return false;
      }
      locksFile.lockedObjects.push(objectId);
      locksFile.updatedAt = new Date().toISOString();
      await storage.writeLocks(sceneId, locksFile);
      return true;
    },

    async release(sceneId: string, objectId: string): Promise<boolean> {
      const locksFile = await storage.readLocks(sceneId);
      const idx = locksFile.lockedObjects.indexOf(objectId);
      if (idx === -1) {
        return false;
      }
      locksFile.lockedObjects.splice(idx, 1);
      locksFile.updatedAt = new Date().toISOString();
      await storage.writeLocks(sceneId, locksFile);
      return true;
    },

    async isLocked(sceneId: string, objectId: string): Promise<boolean> {
      const locksFile = await storage.readLocks(sceneId);
      return locksFile.lockedObjects.includes(objectId);
    },

    async getLockedObjects(sceneId: string): Promise<string[]> {
      const locksFile = await storage.readLocks(sceneId);
      return locksFile.lockedObjects;
    },
  };
}

export function createCryptoPort(): CryptoPort {
  return {
    generateId(): string {
      const now = Date.now();
      const timeHigh = now.toString(16).padStart(12, "0");
      const timeLow = Math.floor(Math.random() * 0x1000).toString(16).padStart(3, "0");
      const version = "7";
      const clockSeq = Math.floor(Math.random() * 0x4000).toString(16).padStart(4, "0");
      const node = Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      return `${timeHigh.slice(0, 8)}-${timeHigh.slice(8)}-${version}${timeLow}-${clockSeq}-${node}`;
    },
    async hash(input: string): Promise<string> {
      const msg = new TextEncoder().encode(input);
      const hash = await crypto.subtle.digest("SHA-256", msg);
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    },
    async verify(input: string, hash: string): Promise<boolean> {
      const computed = await createCryptoPort().hash(input);
      return computed === hash;
    },
  };
}

export function normalizeScene(input: unknown): NormalizeResult {
  const scene = validateScene(input);
  const patches: Patch[] = [];
  return { scene, patches };
}

export function applyPatch(scene: Scene, patch: Patch): Scene {
  const validated = validatePatch(patch);
  const objects = { ...scene.objects };
  const obj = objects[validated.objectId];
  if (!obj) {
    throw new IntentError(ErrorCodes.E_NOT_FOUND, `Object ${validated.objectId} not found`);
  }

  const pathParts = validated.path.split(".").filter((p: string): p is string => Boolean(p));
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    if (!part) continue;
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = pathParts[pathParts.length - 1];
  if (!lastPart) return scene;

  switch (validated.op) {
    case "set":
      if (validated.value !== undefined) {
        current[lastPart] = validated.value;
      }
      break;
    case "unset":
      delete current[lastPart];
      break;
    case "insert":
      if (Array.isArray(current[lastPart]) && validated.index !== undefined) {
        const arr = current[lastPart] as unknown[];
        arr.splice(validated.index, 0, validated.value);
      }
      break;
    case "remove":
      if (Array.isArray(current[lastPart]) && validated.index !== undefined) {
        const arr = current[lastPart] as unknown[];
        arr.splice(validated.index, 1);
      }
      break;
    case "move":
      if (validated.fromIndex !== undefined && validated.toParentId) {
        console.warn("Move operation not fully implemented");
      }
      break;
    case "replace":
      if (validated.value !== undefined) {
        current[lastPart] = validated.value;
      }
      break;
  }

  const updatedObj = { ...obj, updatedAt: new Date().toISOString() };
  objects[validated.objectId] = updatedObj as SceneObject;

  return {
    ...scene,
    revision: scene.revision + 1,
    updatedAt: new Date().toISOString(),
    objects,
  };
}

export async function writePipeline(
  storage: StoragePort,
  lockPort: LockPort,
  sceneId: string,
  patches: Patch[],
  force = false
): Promise<WriteResult> {
  // Check locks: touched object or any ancestor locked → E_LOCKED
  const scene = await storage.readScene(sceneId);
  if (!scene) {
    return { success: false, revision: -1, error: ErrorCodes.E_NOT_FOUND };
  }

  const lockedObjects = await lockPort.getLockedObjects(sceneId);

  for (const patch of patches) {
    // Check if the touched object itself is locked
    if (lockedObjects.includes(patch.objectId)) {
      return { success: false, revision: scene.revision, error: ErrorCodes.E_LOCKED };
    }
    // Check if any ancestor is locked
    let current = scene.objects[patch.objectId]?.parentId;
    while (current) {
      if (lockedObjects.includes(current)) {
        return { success: false, revision: scene.revision, error: ErrorCodes.E_LOCKED };
      }
      current = scene.objects[current]?.parentId;
    }
  }

  for (const patch of patches) {
    if (patch.baseRevision !== scene.revision && !force) {
      return {
        success: false,
        revision: scene.revision,
        error: ErrorCodes.E_CONFLICT,
      };
    }
    // Apply patch - re-read scene each time
    const currentScene = await storage.readScene(sceneId);
    if (!currentScene) {
      return { success: false, revision: -1, error: ErrorCodes.E_NOT_FOUND };
    }
    const newScene = applyPatch(currentScene, patch);
    await storage.writeScene(sceneId, newScene);
  }

  const finalScene = await storage.readScene(sceneId);
  return { success: true, revision: finalScene?.revision ?? scene.revision + patches.length };
}

export { SCHEMA_VERSION, SCENE_SCHEMA_VERSION };