import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import { resolve } from "node:path";
import { createStoragePort, createLockPort } from "./ports";

// Review Focus #1 & trd 6.3: a writer that dies while holding an object lock
// (e.g. SIGKILL mid-write) must not lock that object forever. The registry is
// reclaimed by owner pid/createdAt age once the owner is dead or stale.

describe("Stale object lock reclamation (registry)", () => {
  let testDir: string;
  let storage: ReturnType<typeof createStoragePort>;
  let lockPort: ReturnType<typeof createLockPort>;

  const sceneId = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const objectId = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

  beforeEach(async () => {
    testDir = resolve(os.tmpdir(), `.test-intent-stale-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    storage = createStoragePort(testDir);
    lockPort = createLockPort(storage);
  });

  async function deadPid(): Promise<number> {
    const child = spawn(process.execPath, ["-e", "process.exit(0)"]);
    const pid = child.pid;
    await new Promise<void>((r) => child.on("exit", () => r()));
    await new Promise((r) => setTimeout(r, 50));
    return pid ?? -1;
  }

  async function writeStaleRegistry(lockedObjects: string[], owner: { pid: number; ownerToken: string; createdAt: number }) {
    const locksDir = resolve(testDir, ".intent", "locks");
    await fs.mkdir(locksDir, { recursive: true });
    const locks = {
      version: 1,
      lockedObjects,
      updatedAt: new Date().toISOString(),
      owners: { [objectId]: owner },
    };
    await fs.writeFile(resolve(locksDir, `${sceneId}.locks.json`), JSON.stringify(locks), "utf-8");
  }

  it("reclaims an object lock whose owner process is dead", async () => {
    const pid = await deadPid();
    await writeStaleRegistry([objectId], { pid, ownerToken: "dead-owner", createdAt: Date.now() });

    const acquired = await lockPort.acquire(sceneId, objectId);
    expect(acquired).toBe(true);
    // Attribute is registered by this process' owner token after reclaim
    const locked = await lockPort.isLocked(sceneId, objectId);
    expect(locked).toBe(true);
  }, 10000);

  it("reclaims an object lock whose createdAt is older than the stale window", async () => {
    await writeStaleRegistry([objectId], { pid: process.pid, ownerToken: "ancient-owner", createdAt: Date.now() - 60000 });
    expect(await lockPort.acquire(sceneId, objectId)).toBe(true);
  }, 10000);

  it("does NOT reclaim an object lock held by a live owner", async () => {
    await writeStaleRegistry([objectId], { pid: process.pid, ownerToken: "live-owner", createdAt: Date.now() });
    expect(await lockPort.acquire(sceneId, objectId)).toBe(false);
  }, 10000);

  it("releases only the owner this process registered", async () => {
    // Foreign writer entry: createdAt recent, pid alive, unknown ownerToken.
    await writeStaleRegistry([objectId], { pid: process.pid, ownerToken: "other-process-token", createdAt: Date.now() });
    const released = await lockPort.release(sceneId, objectId);
    expect(released).toBe(false);
  }, 10000);
});
