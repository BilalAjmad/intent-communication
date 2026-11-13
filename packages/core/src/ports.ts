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
import { assertSafeId } from "./paths.js";
import { writeAtomic } from "./atomic.js";

// Debug logging for lock acquisition (writes to .lock-debug.log in cwd)
const debugLockLogEnabled = process.env["DEBUG_LOCK"] === "1";
function debugLog(msg: string) {
  if (!debugLockLogEnabled) return;
  try {
    fs.appendFile(".lock-debug.log", `[${Date.now()}] ${process.pid} ${msg}\n`, { flag: "a" });
  } catch {
    // Debug logging must never break a write.
  }
}

export interface StoragePort {
  /**
   * Absolute root directory this port reads and writes under.
   * `createLockPort` derives the lock directories from it, so storage and
   * locks can never point at different roots (see Review Focus #3).
   */
  readonly rootDir: string;
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

  /**
   * Rejects any path that escapes `basePath`, and any symlink target.
   * Mirrors the adapters-node implementation so the two storage ports cannot
   * drift apart in their safety behaviour (Review Focus #3).
   */
  async function checkPathSafety(targetPath: string, basePath: string): Promise<void> {
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
    } catch (err) {
      // Ignore "path does not exist"; re-throw the symlink rejection.
      if (err instanceof IntentError) throw err;
    }
  }

  return {
    rootDir: resolve(testDir),

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
      await writeAtomic(interviewPath, JSON.stringify(state, null, 0));
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
      await writeAtomic(briefPath, JSON.stringify(brief, null, 0));
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

import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { IntentError, ErrorCodes } from "./error.js";

export function createLockPort(storage: StoragePort, tmpDir?: string): LockPort {
  const fsp = fs;
  const sceneLockDir = tmpDir ?? resolve(storage.rootDir, ".intent", "tmp");

  // In-memory map of sceneId -> ownerToken for scene locks acquired by this process.
  const sceneOwnerTokens = new Map<string, string>();

  function isStale(timestamp: number): boolean {
    return Date.now() - timestamp > 10000;
  }

  function isProcessAlive(pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return (err as NodeJS.ErrnoException).code === "EPERM";
    }
  }

  // In-memory map of `sceneId/objectId` -> ownerToken for object locks acquired by this process.
  const objectOwnerTokens = new Map<string, string>();

  return {
    // Per-object locks are entries in locks.json (the LocksFile registry).
    // All reads/writes go through storage, which provides the atomic-write guarantee (trd 9.1).
    // The scene lock (below) protects the critical section. Entries whose owner is dead
    // or stale are reclaimed on the next acquire so a crashed writer cannot lock an object forever.

    async acquire(sceneId: string, objectId: string): Promise<boolean> {
      assertSafeId(sceneId, "sceneId");
      assertSafeId(objectId, "objectId");
      const locksFile = await storage.readLocks(sceneId);
      const owners = locksFile.owners ?? {};
      const key = `${sceneId}/${objectId}`;
      if (locksFile.lockedObjects.includes(objectId)) {
        const current = owners[objectId];
        if (current && (isStale(current.createdAt) || !isProcessAlive(current.pid))) {
          // Stale entry from a dead or expired owner: reclaim it.
          locksFile.lockedObjects = locksFile.lockedObjects.filter((id: string) => id !== objectId);
          delete owners[objectId];
          locksFile.owners = owners;
          await storage.writeLocks(sceneId, locksFile);
          debugLog(`acquire reclaimed stale lock ${sceneId}/${objectId}`);
        } else {
          debugLog(`acquire already locked ${sceneId}/${objectId}`);
          return false;
        }
      }
      const ownerToken = crypto.randomUUID();
      locksFile.lockedObjects = [...locksFile.lockedObjects, objectId];
      owners[objectId] = { pid: process.pid, ownerToken, createdAt: Date.now() };
      locksFile.owners = owners;
      locksFile.updatedAt = new Date().toISOString();
      await storage.writeLocks(sceneId, locksFile);
      objectOwnerTokens.set(key, ownerToken);
      debugLog(`acquire acquired ${sceneId}/${objectId} ownerToken=${ownerToken}`);
      return true;
    },

    async release(sceneId: string, objectId: string): Promise<boolean> {
      assertSafeId(sceneId, "sceneId");
      assertSafeId(objectId, "objectId");
      const locksFile = await storage.readLocks(sceneId);
      if (!locksFile.lockedObjects.includes(objectId)) {
        debugLog(`release not found ${sceneId}/${objectId}`);
        return false;
      }
      const key = `${sceneId}/${objectId}`;
      const myToken = objectOwnerTokens.get(key);
      const owners = locksFile.owners ?? {};
      const owner = owners[objectId];
      if (!myToken || !owner || owner.ownerToken !== myToken) {
        // Not the owner (or token lost): do not remove someone else's lock.
        debugLog(`release not owner ${sceneId}/${objectId}`);
        return false;
      }
      locksFile.lockedObjects = locksFile.lockedObjects.filter((id: string) => id !== objectId);
      delete owners[objectId];
      locksFile.owners = owners;
      locksFile.updatedAt = new Date().toISOString();
      await storage.writeLocks(sceneId, locksFile);
      objectOwnerTokens.delete(key);
      debugLog(`release released ${sceneId}/${objectId}`);
      return true;
    },

    async isLocked(sceneId: string, objectId: string): Promise<boolean> {
      assertSafeId(sceneId, "sceneId");
      assertSafeId(objectId, "objectId");
      const locksFile = await storage.readLocks(sceneId);
      return locksFile.lockedObjects.includes(objectId);
    },

    async getLockedObjects(sceneId: string): Promise<string[]> {
      assertSafeId(sceneId, "sceneId");
      const locksFile = await storage.readLocks(sceneId);
      const owners = locksFile.owners ?? {};
      // Filter out entries whose owner is dead or stale (legacy entries with no owner info are kept, conservatively).
      return locksFile.lockedObjects.filter((id: string) => {
        const o = owners[id];
        if (!o) return true;
        return !isStale(o.createdAt) && isProcessAlive(o.pid);
      });
    },

    async acquireSceneLock(sceneId: string): Promise<boolean> {
      // trd 9.2 cross-process scene lock: single write lock per scene
      assertSafeId(sceneId, "sceneId");
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
      let delay = 10;
      for (let attempt = 0; attempt < 12; attempt++) {
        try {
          const content = JSON.stringify({ pid: process.pid, host: process.version, createdAt: Date.now(), ownerToken });
          await fsp.writeFile(lockPath, content, { flag: "wx" });
          sceneOwnerTokens.set(sceneId, ownerToken);
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
            const stale = data.createdAt !== undefined && isStale(data.createdAt);
            if (stale) {
              // Re-read to verify ownerToken hasn't changed before unlinking (trd 9.2)
              try {
                const freshContent = await fsp.readFile(lockPath, "utf-8");
                const freshData = JSON.parse(freshContent) as { ownerToken?: string };
                if (freshData.ownerToken !== data.ownerToken) {
                  // Lock replaced by another process; do not unlink
                  const jitter = delay * (0.8 + Math.random() * 0.4);
                  await new Promise((r) => setTimeout(r, Math.min(jitter, 250)));
                  delay = Math.min(delay * 1.6, 250);
                  continue;
                }
              } catch {
                const jitter = delay * (0.8 + Math.random() * 0.4);
                await new Promise((r) => setTimeout(r, Math.min(jitter, 250)));
                delay = Math.min(delay * 1.6, 250);
                continue;
              }
              await fsp.unlink(lockPath);
              continue;
            }
            if (data.pid === undefined) {
              // malformed lock file -> treat as stale and reclaim
              await fsp.unlink(lockPath);
              continue;
            }
            const alive = isProcessAlive(data.pid);
            if (!alive) {
              // owner process is dead -> reclaim the lock
              await fsp.unlink(lockPath);
              continue;
            }
            // lock held by a live owner -> backoff with jitter (trd 9.2)
            const jitter = delay * (0.8 + Math.random() * 0.4);
            await new Promise((r) => setTimeout(r, Math.min(jitter, 250)));
            delay = Math.min(delay * 1.6, 250);
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
      const myToken = sceneOwnerTokens.get(sceneId);
      try {
        // Only remove if ownerToken matches (trd 9.2)
        const content = await fsp.readFile(lockPath, "utf-8");
        const data = JSON.parse(content) as { ownerToken?: string };
        if (myToken && data.ownerToken && data.ownerToken !== myToken) {
          debugLog(`releaseSceneLock ownerToken mismatch ${sceneId}`);
          return false;
        }
        await fsp.unlink(lockPath);
        sceneOwnerTokens.delete(sceneId);
        debugLog(`releaseSceneLock released ${sceneId}`);
        return true;
      } catch {
        sceneOwnerTokens.delete(sceneId);
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
