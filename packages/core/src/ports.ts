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
import { IntentError, ErrorCodes } from "./error.js";
import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";

// Debug logging for lock acquisition (writes to .lock-debug.log in cwd)
const debugLockLogEnabled = process.env["DEBUG_LOCK"] === "1";
function debugLog(msg: string) {
  if (!debugLockLogEnabled) return;
  try {
    fs.appendFile(".lock-debug.log", `[${Date.now()}] ${process.pid} ${msg}\n`, { flag: "a" });
  } catch {}
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
  acquireSceneLock(sceneId: string): Promise<boolean>;
  releaseSceneLock(sceneId: string): Promise<boolean>;
}

export interface CryptoPort {
  generateId(): string;
  hash(input: string): Promise<string>;
  verify(input: string, hash: string): Promise<boolean>;
}

export function createStoragePort(testDir: string): StoragePort {
  const intentDir = resolve(testDir, ".intent");
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

  return {
    async readScene(sceneId: string): Promise<Scene | null> {
      await ensureDirs();
      const scenePath = resolve(scenesDir, `${sceneId}.json`);
      try {
        const content = await fs.readFile(scenePath, "utf-8");
        return JSON.parse(content);
      } catch {
        return null;
      }
    },

    async writeScene(sceneId: string, scene: Scene): Promise<void> {
      await ensureDirs();
      const scenePath = resolve(scenesDir, `${sceneId}.json`);
      const validated = validateScene(scene);
      const tmpPath = `${scenePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(validated, null, 0), "utf-8");
      try {
        await fs.rename(tmpPath, scenePath);
      } catch {
        await fs.writeFile(scenePath, JSON.stringify(validated, null, 0), "utf-8");
      }
    },

    async readLocks(sceneId: string): Promise<LocksFile> {
      await ensureDirs();
      const locksPath = resolve(locksDir, `${sceneId}.locks.json`);
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
      const tmpPath = `${locksPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(locksFile, null, 0), "utf-8");
      try {
        await fs.rename(tmpPath, locksPath);
      } catch {
        await fs.writeFile(locksPath, JSON.stringify(locksFile, null, 0), "utf-8");
      }
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
      const tmpPath = `${configPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(config, null, 0), "utf-8");
      try {
        await fs.rename(tmpPath, configPath);
      } catch {
        await fs.writeFile(configPath, JSON.stringify(config, null, 0), "utf-8");
      }
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
      const tmpPath = `${profilePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(profile, null, 0), "utf-8");
      try {
        await fs.rename(tmpPath, profilePath);
      } catch {
        await fs.writeFile(profilePath, JSON.stringify(profile, null, 0), "utf-8");
      }
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
      const tmpPath = `${interviewPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(state, null, 0), "utf-8");
      try {
        await fs.rename(tmpPath, interviewPath);
      } catch {
        await fs.writeFile(interviewPath, JSON.stringify(state, null, 0), "utf-8");
      }
    },

    async readBrief(briefId: string): Promise<Brief | null> {
      await ensureDirs();
      const briefPath = resolve(briefsDir, `${briefId}.json`);
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
      const tmpPath = `${briefPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(brief, null, 0), "utf-8");
      try {
        await fs.rename(tmpPath, briefPath);
      } catch {
        await fs.writeFile(briefPath, JSON.stringify(brief, null, 0), "utf-8");
      }
    },

    async readFeedback(sceneId: string): Promise<Feedback[]> {
      await ensureDirs();
      const feedbackPath = resolve(feedbackDir, `${sceneId}.json`);
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
      const tmpPath = `${feedbackPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`;
      await fs.writeFile(tmpPath, JSON.stringify(feedback, null, 0), "utf-8");
      try {
        await fs.rename(tmpPath, feedbackPath);
      } catch {
        await fs.writeFile(feedbackPath, JSON.stringify(feedback, null, 0), "utf-8");
      }
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

export function createLockPort(storage: StoragePort, locksDir?: string, tmpDir?: string): LockPort {
  const fsp = fs;
  const sceneLockDir = tmpDir ?? (locksDir ? resolve(locksDir, "..", "tmp") : ".intent/tmp");

  function isStale(timestamp: number): boolean {
    return Date.now() - timestamp > 10000;
  }

  async function isProcessAlive(pid: number): Promise<boolean> {
    if (process.platform === "win32") {
      try {
        const { execFileSync } = await import("node:child_process");
        const output = execFileSync("powershell", [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `Get-Process -Id ${pid} -ErrorAction SilentlyContinue | ForEach-Object { $_.Id }`,
        ], { timeout: 2000, windowsHide: true });
        return output.toString().trim().length > 0;
      } catch {
        return false;
      }
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  const effectiveLocksDir = locksDir ?? ".intent/locks";

  async function ensureObjectLockDir(sceneId: string) {
    const dir = resolve(effectiveLocksDir, sceneId);
    try {
      await fsp.mkdir(dir, { recursive: true });
    } catch {
      // directory creation failure is not fatal; retry below will surface the real error
    }
  }

  return {
    async acquire(sceneId: string, objectId: string): Promise<boolean> {
      await ensureObjectLockDir(sceneId);
      const lockPath = resolve(effectiveLocksDir, sceneId, `${objectId}.lock`);
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          // Atomic creation: if file exists, EEXIST is thrown -> lock is held
          const ownerToken = crypto.randomUUID();
          await fsp.writeFile(lockPath, `${ownerToken}\n`, { flag: "wx" });
          debugLog(`acquire acquired ${sceneId}/${objectId} ownerToken=${ownerToken}`);
          return true;
        } catch (err) {
          const nodeErr = err as NodeJS.ErrnoException;
          if (nodeErr.code === "EEXIST") {
            // Lock is held by another process — brief backoff before retry
            await new Promise((r) => setTimeout(r, 5));
            continue;
          }
          debugLog(`acquire write error ${sceneId}/${objectId} ${nodeErr.code}`);
          return false;
        }
      }
      return false;
    },

    async release(sceneId: string, objectId: string): Promise<boolean> {
      const lockPath = resolve(effectiveLocksDir, sceneId, `${objectId}.lock`);
      try {
        await fsp.unlink(lockPath);
        debugLog(`acquire released ${sceneId}/${objectId}`);
        return true;
      } catch {
        return false;
      }
    },

    async isLocked(sceneId: string, objectId: string): Promise<boolean> {
      const lockPath = resolve(effectiveLocksDir, sceneId, `${objectId}.lock`);
      try {
        await fsp.access(lockPath);
        return true;
      } catch {
        return false;
      }
    },

    async getLockedObjects(sceneId: string): Promise<string[]> {
      const lockDir = resolve(effectiveLocksDir, sceneId);
      let entries: string[];
      try {
        entries = await fsp.readdir(lockDir);
      } catch {
        return [];
      }
      // Extract objectIds from filenames (strip .lock extension)
      return entries
        .filter((e: string) => e.endsWith(".lock"))
        .map((e: string) => e.slice(0, -5));
    },

    async acquireSceneLock(sceneId: string): Promise<boolean> {
      // trd 9.2 cross-process scene lock: single write lock per scene
      debugLog(`acquireSceneLock start ${sceneId}`);
      if (!sceneLockDir) {
        debugLog(`acquireSceneLock no tmp dir ${sceneId}`);
        return false;
      }
      const lockPath = resolve(sceneLockDir, `${sceneId}.lock`);
      const ownerToken = crypto.randomUUID();
      try {
        await fsp.mkdir(sceneLockDir, { recursive: true });
      } catch {
        // directory creation failure is not fatal; retry below will surface the real error
      }
      for (let attempt = 0; attempt < 12; attempt++) {
        try {
          const content = JSON.stringify({ pid: process.pid, host: process.version, createdAt: Date.now(), ownerToken });
          await fsp.writeFile(lockPath, content, { flag: "wx" });
          debugLog(`acquireSceneLock acquired ${sceneId} ownerToken=${ownerToken}`);
          return true;
        } catch (err) {
          const nodeErr = err as NodeJS.ErrnoException;
          if (nodeErr.code !== "EEXIST") {
            debugLog(`acquireSceneLock write error ${sceneId} ${nodeErr.code}`);
            return false;
          }
          try {
            const content = await fsp.readFile(lockPath, "utf-8");
            const data = JSON.parse(content) as { pid?: number; createdAt?: number; ownerToken?: string };
            const stale = data.createdAt !== undefined && Date.now() - data.createdAt > 10000;
            if (stale) {
              await fsp.unlink(lockPath);
              continue;
            }
            if (data.pid === undefined) {
              // malformed lock file -> treat as stale and reclaim
              await fsp.unlink(lockPath);
              continue;
            }
            const alive = await isProcessAlive(data.pid);
            if (!alive) {
              // owner process is dead -> reclaim the lock
              await fsp.unlink(lockPath);
              continue;
            }
            // lock held by a live owner -> brief backoff before retrying within this function
            await new Promise((r) => setTimeout(r, 50));
            continue;
          } catch {
            continue;
          }
        }
      }
      debugLog(`acquireSceneLock timed out ${sceneId}`);
      return false;
    },

    async releaseSceneLock(sceneId: string): Promise<boolean> {
      if (!sceneLockDir) {
        return false;
      }
      const lockPath = resolve(sceneLockDir, `${sceneId}.lock`);
      try {
        await fsp.unlink(lockPath);
        debugLog(`releaseSceneLock released ${sceneId}`);
        return true;
      } catch {
        return false;
      }
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
