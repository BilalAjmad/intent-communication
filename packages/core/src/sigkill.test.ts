import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const testDir = resolve(__dirname, "../../../.test-sigkill-vitest");
const sceneId = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const objectId = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const workerPath = resolve(__dirname, "../../../tests/sigkill/worker.mjs");

function makeObject(id: string, content: string) {
  return {
    id,
    type: "text",
    parentId: null,
    children: [],
    props: { content },
    style: {},
    meta: {},
    updatedAt: new Date().toISOString(),
  };
}

async function setupScene() {
  const intentDir = resolve(testDir, ".intent");
  const scenesDir = resolve(intentDir, "scenes");
  const locksDir = resolve(intentDir, "locks");
  await fs.mkdir(scenesDir, { recursive: true });
  await fs.mkdir(locksDir, { recursive: true });
  const scene = {
    version: 1,
    revision: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    screens: {},
    objects: { [objectId]: makeObject(objectId, "initial") },
    screenOrder: [],
    metadata: { name: "Test", tags: [] },
  };
  await fs.writeFile(resolve(scenesDir, `${sceneId}.json`), JSON.stringify(scene, null, 0));
  await fs.writeFile(resolve(locksDir, `${sceneId}.locks.json`), JSON.stringify({ version: 1, lockedObjects: [], updatedAt: new Date().toISOString() }, null, 0));
}

function runWorker(value: string, baseRevision: number, killAfterMs?: number) {
  return new Promise<{
    success?: boolean;
    acquired?: boolean;
    revision?: number;
    error?: string;
    pid?: number;
  }>((resolve) => {
    const child = spawn("node", [workerPath, testDir, sceneId, objectId, value, String(baseRevision), killAfterMs ? String(killAfterMs) : ""], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.on("close", () => {
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ success: false, error: stdout || "parse error", pid: process.pid });
      }
    });
  });
}

async function readScene() {
  const content = await fs.readFile(resolve(testDir, ".intent", "scenes", `${sceneId}.json`), "utf-8");
  return JSON.parse(content);
}

async function readSceneLock() {
  const lockPath = resolve(testDir, ".intent", "tmp", `${sceneId}.lock`);
  try {
    const content = await fs.readFile(lockPath, "utf-8");
    return JSON.parse(content) as { pid: number; host: string; createdAt: number; ownerToken: string };
  } catch {
    return null;
  }
}

describe("SIGKILL stale lock recovery (trd 9.2 scene lock)", () => {
  beforeEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("child holds scene lock, is SIGKILLed, stale lock reclaimed by next writer", async () => {
    await setupScene();

    // Process 1 acquires the trd 9.2 scene lock and gets killed while holding it
    const killMs = 200;
    const worker1 = await runWorker("value1", 0, killMs);
    expect(worker1.acquired).toBe(true);
    expect(worker1.pid).toBeGreaterThan(0);

    // Lock file should exist immediately (dead process does not release it)
    const lockBeforeKill = await readSceneLock();
    expect(lockBeforeKill).not.toBeNull();
    expect(lockBeforeKill!.pid).toBe(worker1.pid);

    // Give the OS time to reap the killed process so its PID is free
    await new Promise((r) => setTimeout(r, 300));

    // Process 2 should reclaim the stale lock (dead PID) and succeed
    const result2 = await runWorker("value2", 0);
    expect(result2.success).toBe(true);

    // Final scene should have process 2's value with a bumped revision
    const scene = await readScene();
    expect(scene.objects[objectId].props.content).toBe("value2");
    expect(scene.revision).toBe(1);

    // Lock should be released after process 2 completes
    const lockAfter = await readSceneLock();
    expect(lockAfter).toBeNull();
  });
});
