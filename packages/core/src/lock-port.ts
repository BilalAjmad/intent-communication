import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { assertSafeId } from "./paths.js";
import type { StoragePort, LockPort } from "./port-types.js";
// Debug logging for lock acquisition (writes to .lock-debug.log in cwd)
const debugLockLogEnabled = process.env["DEBUG_LOCK"] === "1";
function debugLog(msg: string) {
  if (!debugLockLogEnabled) return;
  fs.appendFile(".lock-debug.log", `[${Date.now()}] ${process.pid} ${msg}\n`, { flag: "a" }).catch(() => {
    // Debug logging must never break a write.
  });
}

export function createLockPort(storage: StoragePort, tmpDir?: string): LockPort {
  const fsp = fs;
  const sceneLockDir = tmpDir ?? resolve(storage.rootDir, ".intent", "tmp");

  // In-memory map of sceneId -> ownerToken for scene locks acquired by this process.
  const sceneOwnerTokens = new Map<string, string>();

  // trd 9.2: a lock entry is stale when its owner's pid is not alive (same
  // machine) or when it is older than 10 s. Pid liveness is the primary check:
  // a live-but-starved owner is never reclaimed (the pre-cf5a988 bug — an
  // age-only 10 s rule let two processes into the critical section). The age
  // cap only covers pid REUSE: a dead owner whose pid was recycled to an
  // unrelated process can never be detected by liveness, so the entry must
  // expire by age. 10 s matches trd 9.2's stale rule and keeps the acceptance
  // window small for short-lived worker processes (Windows reuses pids fast).
  const STALE_AFTER_MS = 10_000;
  function isStale(timestamp: number): boolean {
    return Date.now() - timestamp > STALE_AFTER_MS;
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
      // Backoff between reclaim attempts; a stale lock is taken by atomic rename,
      // the stale contents are unlinked from the quarantine path, and a live
      // owner's fresh lock is renamed back instead of deleted.
      const backoff = (d: number) => Math.min(d * (0.8 + Math.random() * 0.4), 250);
      let delay = 10;
      let transientFailures = 0;
      for (let attempt = 0; attempt < 24; attempt++) {
        try {
          const content = JSON.stringify({ pid: process.pid, createdAt: Date.now(), ownerToken });
          await fsp.writeFile(lockPath, content, { flag: "wx" });
          sceneOwnerTokens.set(sceneId, ownerToken);
          debugLog(`acquireSceneLock acquired ${sceneId} ownerToken=${ownerToken}`);
          return true;
        } catch (err) {
          const nodeErr = err as NodeJS.ErrnoException;
          if (nodeErr.code !== "EEXIST") {
            // Windows: transient EPERM/ENOENT/UNKNOWN under AV/indexer load. A few
            // retries with a short wait beat an immediate failure — the caller retries
            // 50 times anyway, but an instant false poisons the whole burst.
            transientFailures += 1;
            if (transientFailures >= 3) {
              debugLog(`acquireSceneLock write error ${sceneId} ${nodeErr.code}`);
              return false;
            }
            await new Promise((r) => setTimeout(r, 25 * transientFailures));
            continue;
          }
        }

        // Lock file exists — inspect it. Unparseable/torn content is treated as stale.
        let data: { pid?: number; createdAt?: number; ownerToken?: string } | null = null;
        try {
          const content = await fsp.readFile(lockPath, "utf-8");
          data = JSON.parse(content) as { pid?: number; createdAt?: number; ownerToken?: string };
        } catch {
          data = null;
        }
        const stale =
          data === null || data.createdAt === undefined || isStale(data.createdAt) || !isProcessAlive(data.pid as number);

        if (stale) {
          // Quarantine by atomic rename; the loser sees ENOENT and loops.
          const quarantine = `${lockPath}.quarantine.${Date.now()}-${Math.random().toString(36).slice(2)}`;
          try {
            await fsp.rename(lockPath, quarantine);
          } catch {
            await new Promise((r) => setTimeout(r, backoff(delay)));
            delay = Math.min(delay * 1.6, 250);
            continue;
          }
          // Re-verify the quarantined file really is stale; put a live lock back.
          let drop = true;
          try {
            const qc = JSON.parse(await fsp.readFile(quarantine, "utf-8")) as { createdAt?: number; pid?: number; ownerToken?: string };
            const stillStale =
              qc.createdAt === undefined || isStale(qc.createdAt) || !isProcessAlive(qc.pid as number);
            if (!stillStale) {
              try { await fsp.rename(quarantine, lockPath); } catch { /* leave quarantine orphaned */ }
              drop = false;
            }
          } catch {
            drop = true;
          }
          if (drop) {
            await fsp.unlink(quarantine).catch(() => { /* best effort */ });
          } else {
            await new Promise((r) => setTimeout(r, backoff(delay)));
            delay = Math.min(delay * 1.6, 250);
          }
          continue;
        }

        // Live owner — back off with jitter (trd 9.2)
        await new Promise((r) => setTimeout(r, backoff(delay)));
        delay = Math.min(delay * 1.6, 250);
      }
      debugLog(`acquireSceneLock timed out ${sceneId}`);
      return false;
    },

    async releaseSceneLock(sceneId: string): Promise<boolean> {
      if (!sceneLockDir) {
        return false;
      }
      const myToken = sceneOwnerTokens.get(sceneId);
      if (!myToken) {
        // This process never acquired the scene lock — never unlink someone else's.
        debugLog(`releaseSceneLock not the owner ${sceneId}`);
        return false;
      }
      const lockPath = resolve(sceneLockDir, `${sceneId}.lock`);
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
