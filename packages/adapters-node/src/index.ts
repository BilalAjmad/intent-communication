import { promises as fs } from "node:fs";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import {
  Scene,
  LocksFile,
  Config,
  Profile,
  InterviewState,
  Brief,
  Feedback,
  Annotation,
  IntentProfileSchema,
  validateInterviewMetrics,
  type IntentProfile,
  type InterviewMetrics,
  validateScene,
  validateConfig,
  validateProfile,
  validateInterviewState,
  validateBrief,
  validateFeedback,
  validateAnnotation,
} from "@intent/schema";
import {
  StoragePort,
  LockPort,
  CryptoPort,
  IntentError,
  ErrorCodes,
  isIntentError,
  createLockPort,
  assertSafeId,
  writeAtomic,
  checkDocumentVersion,
} from "@intent/core";

function parseChecked(content: string, kind: string): unknown {
  const parsed = JSON.parse(content) as unknown;
  checkDocumentVersion(parsed, kind, 1);
  return parsed;
}

export function createFileStoragePort(projectRoot: string): StoragePort {
  const intentDir = resolve(projectRoot, ".intent");
  const scenesDir = resolve(intentDir, "scenes");
  const locksDir = resolve(intentDir, "locks");
  const configPath = resolve(intentDir, "config.json");
  const profilePath = resolve(intentDir, "profile.json");
  const intentProfilePath = resolve(intentDir, "intent-profile.json");
  const interviewPath = resolve(intentDir, "interview", "state.json");
  const metricsPath = resolve(intentDir, "metrics.json");
  const briefsDir = resolve(intentDir, "briefs");
  const feedbackDir = resolve(intentDir, "feedback");
  const annotationsDir = resolve(intentDir, "annotations");

  // Directory creation happens on WRITE paths only — reads must never
  // materialize a .intent tree (the MCP read tools have no business mkdir-ing).
  async function ensureDirs() {
    await fs.mkdir(scenesDir, { recursive: true });
    await fs.mkdir(locksDir, { recursive: true });
    await fs.mkdir(briefsDir, { recursive: true });
    await fs.mkdir(feedbackDir, { recursive: true });
    await fs.mkdir(annotationsDir, { recursive: true });
    await fs.mkdir(dirname(interviewPath), { recursive: true });
  }

  async function checkPathSafety(targetPath: string, basePath: string) {
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
      if (isIntentError(err)) throw err;
    }
  }

  function isNotFound(err: unknown): boolean {
    return (err as NodeJS.ErrnoException)?.code === "ENOENT";
  }

  return {
    rootDir: resolve(projectRoot),

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
        return validateScene(parseChecked(content, "scene"));
      } catch (err) {
        if (isNotFound(err)) return null;
        if (isIntentError(err)) throw err;
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
      await writeAtomic(scenePath, JSON.stringify(validated, null, 0));
    },

    async readLocks(sceneId: string): Promise<LocksFile> {
      assertSafeId(sceneId, "sceneId");
      const locksPath = resolve(locksDir, `${sceneId}.locks.json`);
      await checkPathSafety(locksPath, locksDir);
      try {
        const content = await fs.readFile(locksPath, "utf-8");
        const data = JSON.parse(content) as Partial<LocksFile> & { lockedObjects?: unknown; owners?: unknown; locks?: unknown };
        checkDocumentVersion(data, "locks", 1);
        // Legacy registry form ({ locks: { <objectId>: owner } }): migrate in-memory to lockedObjects.
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
        if (isNotFound(err)) {
          return {
            version: 1,
            lockedObjects: [],
            updatedAt: new Date().toISOString(),
            owners: {},
          };
        }
        if (isIntentError(err)) throw err;
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
      await checkPathSafety(locksPath, locksDir);
      await writeAtomic(locksPath, JSON.stringify(locksFile, null, 0));
    },

    async readConfig(): Promise<Config> {
      try {
        const content = await fs.readFile(configPath, "utf-8");
        return validateConfig(parseChecked(content, "config"));
      } catch (err) {
        if (isNotFound(err)) {
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
        if (isIntentError(err)) throw err;
        throw new IntentError(
          ErrorCodes.E_SCHEMA,
          `Config file .intent/config.json is unreadable or invalid: ${(err as Error).message}`
        );
      }
    },

    async writeConfig(config: Config): Promise<void> {
      await ensureDirs();
      await checkPathSafety(configPath, intentDir);
      await writeAtomic(configPath, JSON.stringify(config, null, 0));
    },

    async readProfile(): Promise<Profile | null> {
      try {
        const content = await fs.readFile(profilePath, "utf-8");
        return validateProfile(parseChecked(content, "profile"));
      } catch (err) {
        if (isNotFound(err)) return null;
        if (isIntentError(err)) throw err;
        throw new IntentError(
          ErrorCodes.E_SCHEMA,
          `Profile file .intent/profile.json is unreadable or invalid: ${(err as Error).message}`
        );
      }
    },

    async readIntentProfile(): Promise<IntentProfile> {
      try {
        const content = await fs.readFile(intentProfilePath, "utf-8");
        return IntentProfileSchema.parse(parseChecked(content, "intent-profile"));
      } catch (err) {
        if (isNotFound(err)) return { schemaVersion: 1, entries: [] };
        if (isIntentError(err)) throw err;
        throw new IntentError(
          ErrorCodes.E_SCHEMA,
          `Intent profile .intent/intent-profile.json is unreadable or invalid: ${(err as Error).message}`
        );
      }
    },

    async writeIntentProfile(profile: IntentProfile): Promise<void> {
      await ensureDirs();
      await checkPathSafety(intentProfilePath, intentDir);
      await writeAtomic(intentProfilePath, JSON.stringify(IntentProfileSchema.parse(profile), null, 0));
    },

    async writeProfile(profile: Profile): Promise<void> {
      await ensureDirs();
      await checkPathSafety(profilePath, intentDir);
      await writeAtomic(profilePath, JSON.stringify(profile, null, 0));
    },

    async readInterviewState(): Promise<InterviewState | null> {
      try {
        const content = await fs.readFile(interviewPath, "utf-8");
        return validateInterviewState(parseChecked(content, "interview-state"));
      } catch (err) {
        if (isNotFound(err)) return null;
        if (isIntentError(err)) throw err;
        throw new IntentError(
          ErrorCodes.E_SCHEMA,
          `Interview state .intent/interview/state.json is unreadable or invalid: ${(err as Error).message}`
        );
      }
    },

    async writeInterviewState(state: InterviewState): Promise<void> {
      await ensureDirs();
      await checkPathSafety(interviewPath, intentDir);
      await writeAtomic(interviewPath, JSON.stringify(state, null, 0));
    },

    async readInterviewMetrics(): Promise<InterviewMetrics> {
      try {
        const content = await fs.readFile(metricsPath, "utf-8");
        return validateInterviewMetrics(parseChecked(content, "interview-metrics"));
      } catch (err) {
        if (isNotFound(err)) return { schemaVersion: 1, sessions: [] };
        if (isIntentError(err)) throw err;
        throw new IntentError(
          ErrorCodes.E_SCHEMA,
          `Metrics file .intent/metrics.json is unreadable or invalid: ${(err as Error).message}`
        );
      }
    },

    async writeInterviewMetrics(metrics: InterviewMetrics): Promise<void> {
      await ensureDirs();
      await checkPathSafety(metricsPath, intentDir);
      await writeAtomic(metricsPath, JSON.stringify(validateInterviewMetrics(metrics), null, 0));
    },

    async readBrief(briefId: string): Promise<Brief | null> {
      assertSafeId(briefId, "briefId");
      const briefPath = resolve(briefsDir, `${briefId}.json`);
      await checkPathSafety(briefPath, briefsDir);
      try {
        const content = await fs.readFile(briefPath, "utf-8");
        return validateBrief(parseChecked(content, "brief"));
      } catch (err) {
        if (isNotFound(err)) return null;
        if (isIntentError(err)) throw err;
        throw new IntentError(
          ErrorCodes.E_SCHEMA,
          `Brief file .intent/briefs/${briefId}.json is unreadable or invalid: ${(err as Error).message}`
        );
      }
    },

    async writeBrief(brief: Brief): Promise<void> {
      await ensureDirs();
      assertSafeId(brief.id, "brief.id");
      const briefPath = resolve(briefsDir, `${brief.id}.json`);
      await checkPathSafety(briefPath, briefsDir);
      await writeAtomic(briefPath, JSON.stringify(brief, null, 0));
    },

    async readFeedback(sceneId: string): Promise<Feedback[]> {
      assertSafeId(sceneId, "sceneId");
      const feedbackPath = resolve(feedbackDir, `${sceneId}.json`);
      await checkPathSafety(feedbackPath, feedbackDir);
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
            throw new IntentError(
              ErrorCodes.E_SCHEMA,
              `Feedback file .intent/feedback/${sceneId}.json: entry ${i} is invalid: ${(err as Error).message}`
            );
          }
        });
      } catch (err) {
        if (isNotFound(err)) return [];
        if (isIntentError(err)) throw err;
        throw new IntentError(
          ErrorCodes.E_SCHEMA,
          `Feedback file .intent/feedback/${sceneId}.json is unreadable or invalid: ${(err as Error).message}`
        );
      }
    },

    async writeFeedback(sceneId: string, feedback: Feedback[]): Promise<void> {
      await ensureDirs();
      assertSafeId(sceneId, "sceneId");
      const feedbackPath = resolve(feedbackDir, `${sceneId}.json`);
      await checkPathSafety(feedbackPath, feedbackDir);
      await writeAtomic(feedbackPath, JSON.stringify(feedback, null, 0));
    },

    async readAnnotations(sceneId: string): Promise<Annotation[]> {
      assertSafeId(sceneId, "sceneId");
      const annotationsPath = resolve(annotationsDir, `${sceneId}.json`);
      await checkPathSafety(annotationsPath, annotationsDir);
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
            checkDocumentVersion(item, "annotation", 1);
            return validateAnnotation(item);
          } catch (err) {
            if (isIntentError(err)) throw err; // E_VERSION propagates as-is; never rewritten to E_SCHEMA
            throw new IntentError(
              ErrorCodes.E_SCHEMA,
              `Annotations file .intent/annotations/${sceneId}.json: entry ${i} is invalid: ${(err as Error).message}`
            );
          }
        });
      } catch (err) {
        if (isNotFound(err)) return [];
        if (isIntentError(err)) throw err;
        throw new IntentError(
          ErrorCodes.E_SCHEMA,
          `Annotations file .intent/annotations/${sceneId}.json is unreadable or invalid: ${(err as Error).message}`
        );
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
      await checkPathSafety(annotationsPath, annotationsDir);
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
      // PNG signature + IHDR (width/height at byte offsets 16/20, big-endian).
      const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (png.length < 33 || !png.subarray(0, 8).equals(PNG_MAGIC) || png.toString("ascii", 12, 16) !== "IHDR") {
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
        if (isNotFound(err)) return null;
        if (isIntentError(err)) throw err;
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
        if (isNotFound(err)) return [];
        throw err;
      }
    },
  };
}

export function createFileLockPort(projectRoot: string): LockPort {
  const intentDir = resolve(projectRoot, ".intent");
  return createLockPort(createFileStoragePort(projectRoot), resolve(intentDir, "tmp"));
}

export { createNodeCryptoPort } from "./crypto-port.js";

export { IntentError, ErrorCodes, isIntentError, createLockPort };
export { createFileWatcher } from "./watch.js";
export type { FileWatcher, FileWatcherOptions } from "./watch.js";
export type { StoragePort, LockPort, CryptoPort };
export { findFirstRenderBaseline } from "./versions-baseline.js";
export type { FirstRenderBaseline } from "./versions-baseline.js";
