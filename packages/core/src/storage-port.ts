import { promises as fs } from "node:fs";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import {
  Scene, LocksFile, Config, Profile, InterviewState, Brief, Feedback, Annotation,
  validateScene, validateConfig, validateProfile, validateInterviewState, validateBrief, validateFeedback, validateAnnotation,
} from "@intent/schema";
import { IntentError, ErrorCodes } from "./error.js";
import { assertSafeId } from "./paths.js";
import { writeAtomic } from "./atomic.js";
import type { StoragePort } from "./port-types.js";

export function createStoragePort(testDir: string): StoragePort {
  const intentDir = resolve(testDir, ".intent");
  const scenesDir = resolve(intentDir, "scenes");
  const locksDir = resolve(intentDir, "locks");
  const configPath = resolve(intentDir, "config.json");
  const profilePath = resolve(intentDir, "profile.json");
  const interviewPath = resolve(intentDir, "interview", "state.json");
  const briefsDir = resolve(intentDir, "briefs");
  const feedbackDir = resolve(intentDir, "feedback");
  const annotationsDir = resolve(intentDir, "annotations");

  async function ensureDirs() {
    await fs.mkdir(scenesDir, { recursive: true });
    await fs.mkdir(locksDir, { recursive: true });
    await fs.mkdir(briefsDir, { recursive: true });
    await fs.mkdir(feedbackDir, { recursive: true });
    await fs.mkdir(annotationsDir, { recursive: true });
    await fs.mkdir(dirname(interviewPath), { recursive: true });
  }

  /**
   * Rejects any path that escapes `basePath`, and any symlink target.
   * Mirrors the adapters-node implementation so the two storage ports cannot
   * drift apart in their safety behaviour (Review Focus #3).
   */
  async function checkPathSafety(targetPath: string, basePath: string): Promise<void> {
    const resolved = resolve(targetPath);
    const resolvedBase = resolve(basePath);
    const rel = relative(resolvedBase, resolved);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new IntentError(ErrorCodes.E_PATH_TRAVERSAL, "Path traversal attempt detected");
    }
    try {
      const stats = await fs.lstat(resolved);
      if (stats.isSymbolicLink()) {
        throw new IntentError(ErrorCodes.E_SYMLINK, "Symlinks not allowed");
      }
    } catch (err) {
      // Missing file is fine; symlink rejection is re-thrown.
      if (err instanceof IntentError) throw err;
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw err;
    }
  }

  return {
    rootDir: resolve(testDir),

    async readScene(sceneId: string): Promise<Scene | null> {
      assertSafeId(sceneId, "sceneId");
      const scenePath = resolve(scenesDir, `${sceneId}.json`);
      await checkPathSafety(scenePath, scenesDir);
      try {
        // trd 20: scene file hard limit is 5 MB; refuse oversized files up front.
        const stats = await fs.stat(scenePath);
        if (stats.size > 5 * 1024 * 1024) {
          throw new IntentError(ErrorCodes.E_BAD_REQUEST, "Scene file exceeds the 5 MB hard limit");
        }
        const content = await fs.readFile(scenePath, "utf-8");
        return validateScene(JSON.parse(content));
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
        if (err instanceof IntentError) throw err;
        throw new IntentError(
          ErrorCodes.E_INVALID_SCENE,
          `Scene file .intent/scenes/${sceneId}.json is unreadable or invalid: ${(err as Error).message}`
        );
      }
    },

    async writeScene(sceneId: string, scene: Scene): Promise<void> {
      await ensureDirs();
      assertSafeId(sceneId, "sceneId");
      const scenePath = resolve(scenesDir, `${sceneId}.json`);
      await checkPathSafety(scenePath, scenesDir);
      const validated = validateScene(scene);
      const serialized = JSON.stringify(validated, null, 0);
      if (Buffer.byteLength(serialized, "utf-8") > 5 * 1024 * 1024) {
        throw new IntentError(ErrorCodes.E_LIMIT, "Scene exceeds the 5 MB hard limit");
      }
      await writeAtomic(scenePath, serialized);
    },

    async readLocks(sceneId: string): Promise<LocksFile> {
      assertSafeId(sceneId, "sceneId");
      const locksPath = resolve(locksDir, `${sceneId}.locks.json`);
      try {
        const content = await fs.readFile(locksPath, "utf-8");
        const data = JSON.parse(content) as Partial<LocksFile> & { lockedObjects?: unknown; owners?: unknown; locks?: unknown };
        if (data.lockedObjects === undefined && data.locks && typeof data.locks === "object" && !Array.isArray(data.locks)) {
          data.lockedObjects = Object.keys(data.locks as Record<string, unknown>);
        }
        if (!Array.isArray(data.lockedObjects) || data.lockedObjects.some((id) => typeof id !== "string")) {
          throw new IntentError(ErrorCodes.E_SCHEMA, `Lock file for scene ${sceneId} has an invalid lockedObjects array`);
        }
        if (data.owners !== undefined && (typeof data.owners !== "object" || data.owners === null || Array.isArray(data.owners))) {
          throw new IntentError(ErrorCodes.E_SCHEMA, `Lock file for scene ${sceneId} has an invalid owners map`);
        }
        return {
          version: data.version ?? 1,
          lockedObjects: data.lockedObjects,
          updatedAt: data.updatedAt ?? new Date().toISOString(),
          owners: (data.owners as LocksFile["owners"]) ?? {},
        };
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
          return {
            version: 1,
            lockedObjects: [],
            updatedAt: new Date().toISOString(),
            owners: {},
          };
        }
        if (err instanceof IntentError) throw err;
        throw new IntentError(
          ErrorCodes.E_SCHEMA,
          `Lock file .intent/locks/${sceneId}.locks.json is unreadable or invalid: ${(err as Error).message}`
        );
      }
    },

    async writeLocks(sceneId: string, locksFile: LocksFile): Promise<void> {
      await ensureDirs();
      assertSafeId(sceneId, "sceneId");
      const locksPath = resolve(locksDir, `${sceneId}.locks.json`);
      await writeAtomic(locksPath, JSON.stringify(locksFile, null, 0));
    },

    async readConfig(): Promise<Config> {
      try {
        const content = await fs.readFile(configPath, "utf-8");
        return validateConfig(JSON.parse(content));
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        return {
          version: 1,
          projectName: "Intent Project",
          previewPort: 3456,
          studioPort: 3457,
          mcpPort: 3458,
          maxBytes: 32768,
          autoSave: true,
          lockTTL: 30000,
          breakpoints: { sm: 640, md: 1024, lg: 1440 },
        };
        }
        if (err instanceof IntentError) throw err;
        throw new IntentError(ErrorCodes.E_SCHEMA, `Config file .intent/config.json is unreadable or invalid: ${(err as Error).message}`);
      }
    },

    async writeConfig(config: Config): Promise<void> {
      await ensureDirs();
      await writeAtomic(configPath, JSON.stringify(config, null, 0));
    },

    async readProfile(): Promise<Profile | null> {
      try {
        const content = await fs.readFile(profilePath, "utf-8");
        return validateProfile(JSON.parse(content));
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
        if (err instanceof IntentError) throw err;
        throw new IntentError(ErrorCodes.E_SCHEMA, `Profile file .intent/profile.json is unreadable or invalid: ${(err as Error).message}`);
      }
    },

    async writeProfile(profile: Profile): Promise<void> {
      await ensureDirs();
      await writeAtomic(profilePath, JSON.stringify(profile, null, 0));
    },

    async readInterviewState(): Promise<InterviewState | null> {
      try {
        const content = await fs.readFile(interviewPath, "utf-8");
        return validateInterviewState(JSON.parse(content));
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
        if (err instanceof IntentError) throw err;
        throw new IntentError(ErrorCodes.E_SCHEMA, `Interview state .intent/interview/state.json is unreadable or invalid: ${(err as Error).message}`);
      }
    },

    async writeInterviewState(state: InterviewState): Promise<void> {
      await ensureDirs();
      await writeAtomic(interviewPath, JSON.stringify(state, null, 0));
    },

    async readBrief(briefId: string): Promise<Brief | null> {
      assertSafeId(briefId, "briefId");
      const briefPath = resolve(briefsDir, `${briefId}.json`);
      try {
        const content = await fs.readFile(briefPath, "utf-8");
        return validateBrief(JSON.parse(content));
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
        if (err instanceof IntentError) throw err;
        throw new IntentError(ErrorCodes.E_SCHEMA, `Brief file .intent/briefs/${briefId}.json is unreadable or invalid: ${(err as Error).message}`);
      }
    },

    async writeBrief(brief: Brief): Promise<void> {
      await ensureDirs();
      assertSafeId(brief.id, "brief.id");
      const briefPath = resolve(briefsDir, `${brief.id}.json`);
      await writeAtomic(briefPath, JSON.stringify(brief, null, 0));
    },

    async readFeedback(sceneId: string): Promise<Feedback[]> {
      assertSafeId(sceneId, "sceneId");
      const feedbackPath = resolve(feedbackDir, `${sceneId}.json`);
      try {
        const content = await fs.readFile(feedbackPath, "utf-8");
        const data = JSON.parse(content) as unknown;
        if (!Array.isArray(data)) {
          throw new IntentError(ErrorCodes.E_SCHEMA, `Feedback file for scene ${sceneId} is not an array`);
        }
        return data.map((item, i) => {
          try {
            return validateFeedback(item);
          } catch (err) {
            throw new IntentError(ErrorCodes.E_SCHEMA, `Feedback file .intent/feedback/${sceneId}.json: entry ${i} is invalid: ${(err as Error).message}`);
          }
        });
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
        if (err instanceof IntentError) throw err;
        throw new IntentError(ErrorCodes.E_SCHEMA, `Feedback file .intent/feedback/${sceneId}.json is unreadable or invalid: ${(err as Error).message}`);
      }
    },

    async writeFeedback(sceneId: string, feedback: Feedback[]): Promise<void> {
      await ensureDirs();
      assertSafeId(sceneId, "sceneId");
      const feedbackPath = resolve(feedbackDir, `${sceneId}.json`);
      await writeAtomic(feedbackPath, JSON.stringify(feedback, null, 0));
    },

    async readAnnotations(sceneId: string): Promise<Annotation[]> {
      assertSafeId(sceneId, "sceneId");
      const annotationsPath = resolve(annotationsDir, `${sceneId}.json`);
      try {
        const content = await fs.readFile(annotationsPath, "utf-8");
        if (content.length > 1_000_000) {
          throw new IntentError(ErrorCodes.E_SCHEMA, "Annotations file exceeds the 1 MB limit");
        }
        const data = JSON.parse(content) as unknown;
        if (!Array.isArray(data)) {
          throw new IntentError(ErrorCodes.E_SCHEMA, `Annotations file for scene ${sceneId} is not an array`);
        }
        return data.map((item, i) => {
          try {
            return validateAnnotation(item);
          } catch (err) {
            throw new IntentError(ErrorCodes.E_SCHEMA, `Annotations file .intent/annotations/${sceneId}.json: entry ${i} is invalid: ${(err as Error).message}`);
          }
        });
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
        if (err instanceof IntentError) throw err;
        throw new IntentError(ErrorCodes.E_SCHEMA, `Annotations file .intent/annotations/${sceneId}.json is unreadable or invalid: ${(err as Error).message}`);
      }
    },

    async writeAnnotations(sceneId: string, annotations: Annotation[]): Promise<void> {
      await ensureDirs();
      assertSafeId(sceneId, "sceneId");
      const serialized = JSON.stringify(annotations);
      if (serialized.length > 1_000_000) {
        throw new IntentError(ErrorCodes.E_SCHEMA, "Annotations payload exceeds the 1 MB limit");
      }
      const annotationsPath = resolve(annotationsDir, `${sceneId}.json`);
      await writeAtomic(annotationsPath, serialized);
    },

    async writeAnnotationImage(
      sceneId: string,
      annotationId: string,
      png: Buffer,
    ): Promise<{ file: string; width: number; height: number }> {
      assertSafeId(sceneId, "sceneId");
      if (!/^a_[0-9A-HJKMNP-TV-Z]{26}$/.test(annotationId)) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "Invalid annotation id");
      }
      if (png.length === 0 || png.length > 1_000_000) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "PNG exceeds the 1 MB server limit");
      }
      const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (png.length < 33 || !png.subarray(0, 8).equals(PNG_MAGIC) || png.toString("latin1", 12, 16) !== "IHDR") {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "Not a valid PNG file");
      }
      const width = png.readUInt32BE(16);
      const height = png.readUInt32BE(20);
      if (width < 1 || height < 1 || width > 4096 || height > 4096) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "PNG dimensions out of range (max 4096)");
      }
      const dir = resolve(annotationsDir, sceneId);
      await fs.mkdir(dir, { recursive: true });
      const target = resolve(dir, `${annotationId}.png`);
      await checkPathSafety(target, dir);
      await fs.writeFile(target, png, { mode: 0o600 });
      return { file: `${annotationId}.png`, width, height };
    },

    async readAnnotationImage(sceneId: string, file: string): Promise<Buffer | null> {
      assertSafeId(sceneId, "sceneId");
      if (!/^a_[0-9A-HJKMNP-TV-Z]{26}\.png$/.test(file)) {
        throw new IntentError(ErrorCodes.E_BAD_REQUEST, "Invalid image file name");
      }
      const target = resolve(annotationsDir, sceneId, file);
      await checkPathSafety(target, resolve(annotationsDir, sceneId));
      try {
        const stats = await fs.stat(target);
        if (stats.size > 1_000_000) {
          throw new IntentError(ErrorCodes.E_BAD_REQUEST, "PNG exceeds the 1 MB server limit");
        }
        return await fs.readFile(target);
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
        if (err instanceof IntentError) throw err;
        throw err;
      }
    },

    async listScenes(): Promise<string[]> {
      try {
        const entries = await fs.readdir(scenesDir);
        return entries
          .filter((e: string) => e.endsWith(".json"))
          .map((e: string) => e.slice(0, -5));
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
        throw err;
      }
    },
  };
}
