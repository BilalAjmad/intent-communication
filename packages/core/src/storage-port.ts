import { promises as fs } from "node:fs";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import {
  Scene, LocksFile, Config, Profile, InterviewState, Brief, Feedback, Annotation,
  validateScene, validateConfig, validateProfile, validateInterviewState, validateBrief, validateFeedback, validateAnnotation,
  IntentProfileSchema, validateInterviewMetrics, type InterviewMetrics, type IntentProfile,
  LocksFileSchema,
} from "@intent/schema";
import { IntentError, ErrorCodes } from "./error.js";
import { checkDocumentVersion } from "./migrations.js";
import { assertSafeId } from "./paths.js";
import { writeAtomic } from "./atomic.js";
import type { StoragePort } from "./port-types.js";

export function createStoragePort(testDir: string): StoragePort {
  const intentDir = resolve(testDir, ".intent");
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

  async function ensureDirs() {
    await fs.mkdir(scenesDir, { recursive: true });
    await fs.mkdir(locksDir, { recursive: true });
    await fs.mkdir(briefsDir, { recursive: true });
    await fs.mkdir(feedbackDir, { recursive: true });
    await fs.mkdir(annotationsDir, { recursive: true });
    await fs.mkdir(dirname(interviewPath), { recursive: true });
  }

  /**
   * Rejects any path that escapes `basePath`, and any symlink in ANY path
   * component (final file or an ancestor directory) — a symlinked ancestor
   * would otherwise redirect writes outside the project root.
   */
  async function checkPathSafety(targetPath: string, basePath: string): Promise<void> {
    const resolved = resolve(targetPath);
    const resolvedBase = resolve(basePath);
    const rel = relative(resolvedBase, resolved);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      throw new IntentError(ErrorCodes.E_PATH_TRAVERSAL, "Path traversal attempt detected");
    }
    // Walk every component from the base down to the target; lstat each.
    const segments = rel.split(/[\\/]+/).filter((s) => s.length > 0);
    let cursor = resolvedBase;
    for (const segment of segments) {
      cursor = resolve(cursor, segment);
      try {
        const stats = await fs.lstat(cursor);
        if (stats.isSymbolicLink()) {
          throw new IntentError(ErrorCodes.E_SYMLINK, `Symlinks not allowed in path: ${segment}`);
        }
      } catch (err) {
        if (err instanceof IntentError) throw err;
        const code = (err as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") throw err;
        return; // A missing component ends the chain — nothing to verify further down.
      }
    }
  }

  /** Read a UTF-8 file with a hard byte cap, applied BEFORE the read (not after). */
  async function readFileCapped(filePath: string, maxBytes: number, label: string): Promise<string> {
    const stats = await fs.stat(filePath);
    if (stats.size > maxBytes) {
      throw new IntentError(ErrorCodes.E_LIMIT, `${label} exceeds the ${maxBytes}-byte hard limit`);
    }
    return fs.readFile(filePath, "utf-8");
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
        const parsedScene = JSON.parse(content) as unknown;
        checkDocumentVersion(parsedScene, "scene", 1);
        return validateScene(parsedScene);
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
        const content = await readFileCapped(locksPath, 1024 * 1024, `Lock file for scene ${sceneId}`);
        const data = JSON.parse(content) as Partial<LocksFile> & { lockedObjects?: unknown; owners?: unknown; locks?: unknown };
        checkDocumentVersion(data, "locks", 1);
        if (data.lockedObjects === undefined && data.locks && typeof data.locks === "object" && !Array.isArray(data.locks)) {
          data.lockedObjects = Object.keys(data.locks as Record<string, unknown>);
        }
        // Full schema enforcement — hand-rolled shape checks alone let a crafted
        // locks.json through with unbounded lockedObjects/owners entries.
        const parsed = LocksFileSchema.parse({
          version: data.version ?? 1,
          lockedObjects: data.lockedObjects,
          updatedAt: data.updatedAt ?? new Date().toISOString(),
          owners: data.owners ?? {},
        });
        return {
          version: 1,
          lockedObjects: parsed.lockedObjects,
          updatedAt: parsed.updatedAt,
          owners: (parsed.owners as LocksFile["owners"]) ?? {},
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
      // Validate on write too — a bad in-memory shape must not poison the file.
      const serialized = JSON.stringify(LocksFileSchema.parse(locksFile), null, 0);
      await writeAtomic(locksPath, serialized);
    },

    async readConfig(): Promise<Config> {
      try {
        const content = await readFileCapped(configPath, 1024 * 1024, "Config file");
        const parsedConfig = JSON.parse(content) as unknown;
        checkDocumentVersion(parsedConfig, "config", 1);
        return validateConfig(parsedConfig);
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
        const content = await readFileCapped(profilePath, 2 * 1024 * 1024, "Profile file");
        const parsedProfile = JSON.parse(content) as unknown;
        checkDocumentVersion(parsedProfile, "profile", 1);
        return validateProfile(parsedProfile);
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

    async readIntentProfile(): Promise<IntentProfile> {
      try {
        const content = await readFileCapped(intentProfilePath, 2 * 1024 * 1024, "Intent profile");
        const parsedIntentProfile = JSON.parse(content) as unknown;
        checkDocumentVersion(parsedIntentProfile, "intent-profile", 1);
        return IntentProfileSchema.parse(parsedIntentProfile);
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return { schemaVersion: 1, entries: [] };
        if (err instanceof IntentError) throw err;
        throw new IntentError(ErrorCodes.E_SCHEMA, `Intent profile .intent/intent-profile.json is unreadable or invalid: ${(err as Error).message}`);
      }
    },

    async writeIntentProfile(profile: IntentProfile): Promise<void> {
      await ensureDirs();
      await checkPathSafety(intentProfilePath, intentDir);
      await writeAtomic(intentProfilePath, JSON.stringify(IntentProfileSchema.parse(profile), null, 0));
    },

    async readInterviewState(): Promise<InterviewState | null> {
      try {
        const content = await readFileCapped(interviewPath, 5 * 1024 * 1024, "Interview state");
        const parsedInterview = JSON.parse(content) as unknown;
        checkDocumentVersion(parsedInterview, "interview-state", 1);
        return validateInterviewState(parsedInterview);
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

    async readInterviewMetrics(): Promise<InterviewMetrics> {
      try {
        const content = await readFileCapped(metricsPath, 2 * 1024 * 1024, "Interview metrics");
        const parsed = JSON.parse(content) as unknown;
        checkDocumentVersion(parsed, "interview-metrics", 1);
        return validateInterviewMetrics(parsed);
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return { schemaVersion: 1, sessions: [] };
        if (err instanceof IntentError) throw err;
        throw new IntentError(ErrorCodes.E_SCHEMA, `Metrics file .intent/metrics.json is unreadable or invalid: ${(err as Error).message}`);
      }
    },

    async writeInterviewMetrics(metrics: InterviewMetrics): Promise<void> {
      await ensureDirs();
      await writeAtomic(metricsPath, JSON.stringify(validateInterviewMetrics(metrics), null, 0));
    },

    async readBrief(briefId: string): Promise<Brief | null> {
      assertSafeId(briefId, "briefId");
      const briefPath = resolve(briefsDir, `${briefId}.json`);
      try {
        const content = await readFileCapped(briefPath, 5 * 1024 * 1024, `Brief file ${briefId}`);
        const parsedBrief = JSON.parse(content) as unknown;
        checkDocumentVersion(parsedBrief, "brief", 1);
        return validateBrief(parsedBrief);
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
        const content = await readFileCapped(feedbackPath, 5 * 1024 * 1024, `Feedback file for scene ${sceneId}`);
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
        // Cap measured in BYTES, before the read fully happens (stat-based).
        const content = await readFileCapped(annotationsPath, 1_000_000, `Annotations file for scene ${sceneId}`);
        const data = JSON.parse(content) as unknown;
        if (!Array.isArray(data)) {
          throw new IntentError(ErrorCodes.E_SCHEMA, `Annotations file for scene ${sceneId} is not an array`);
        }
        return data.map((item, i) => {
          try {
            checkDocumentVersion(item, "annotation", 1);
            return validateAnnotation(item);
          } catch (err) {
            if (err instanceof IntentError) throw err;
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
      // Refuse symlinked ancestors (not just the final file) before mkdir.
      await checkPathSafety(dir, annotationsDir);
      await fs.mkdir(dir, { recursive: true });
      const target = resolve(dir, `${annotationId}.png`);
      await checkPathSafety(target, dir);
      // Atomic + exclusive — never a torn PNG served as valid.
      await writeAtomic(target, png);
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
        const buf = await fs.readFile(target);
        // TOCTOU + integrity: re-check size and magic bytes after the read too.
        if (buf.length > 1_000_000) {
          throw new IntentError(ErrorCodes.E_BAD_REQUEST, "PNG exceeds the 1 MB server limit");
        }
        const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_MAGIC) || buf.toString("latin1", 12, 16) !== "IHDR") {
          throw new IntentError(ErrorCodes.E_BAD_REQUEST, "Not a valid PNG file");
        }
        return buf;
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
