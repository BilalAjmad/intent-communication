import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import {
  Scene,
  LocksFile,
  Config,
  Profile,
  InterviewState,
  Brief,
  Feedback,
  validateScene,
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
} from "@intent/core";

export function createFileStoragePort(projectRoot: string): StoragePort {
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
      // Ignore: path doesn't exist or is not a symlink
    }
  }

  return {
    rootDir: resolve(projectRoot),

    async readScene(sceneId: string): Promise<Scene | null> {
      await ensureDirs();
      assertSafeId(sceneId, "sceneId");
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
      assertSafeId(sceneId, "sceneId");
      const scenePath = resolve(scenesDir, `${sceneId}.json`);
      await checkPathSafety(scenePath, scenesDir);
      const validated = validateScene(scene);
      await writeAtomic(scenePath, JSON.stringify(validated, null, 0));
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
          owners: data.owners ?? {},
        };
      } catch {
        return {
          version: 1,
          lockedObjects: [],
          updatedAt: new Date().toISOString(),
          owners: {},
        };
      }
    },

    async writeLocks(sceneId: string, locksFile: LocksFile): Promise<void> {
      await ensureDirs();
      const locksPath = resolve(locksDir, `${sceneId}.locks.json`);
      await checkPathSafety(locksPath, locksDir);
      await writeAtomic(locksPath, JSON.stringify(locksFile, null, 0));
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
      await writeAtomic(configPath, JSON.stringify(config, null, 0));
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
      await writeAtomic(profilePath, JSON.stringify(profile, null, 0));
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
      await writeAtomic(interviewPath, JSON.stringify(state, null, 0));
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
      await writeAtomic(briefPath, JSON.stringify(brief, null, 0));
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
      await writeAtomic(feedbackPath, JSON.stringify(feedback, null, 0));
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

export function createFileLockPort(projectRoot: string): LockPort {
  const intentDir = resolve(projectRoot, ".intent");
  return createLockPort(createFileStoragePort(projectRoot), resolve(intentDir, "tmp"));
}

export function createNodeCryptoPort(): CryptoPort {
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
      const crypto = await import("node:crypto");
      return crypto.createHash("sha256").update(input).digest("hex");
    },
    async verify(input: string, hash: string): Promise<boolean> {
      const computed = await createNodeCryptoPort().hash(input);
      return computed === hash;
    },
  };
}

export { IntentError, ErrorCodes, isIntentError, createLockPort };
export type { StoragePort, LockPort, CryptoPort };