import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { Scene } from "@intent/schema";
import { randomUUID } from "node:crypto";

const workerPath = resolve(__dirname, "../../../tests/multi-process/worker.mjs");
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // matches trd 3.1 regex [0-9A-HJKMNP-TV-Z]
const N_SUCCESS_PER_WORKER = 1;

function randomCrockford26(): string {
  const bytes = new Uint32Array(26);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => CROCKFORD[n % 32]).join("");
}

function genId(prefix: string): string {
  return `${prefix}_${randomCrockford26()}`;
}

function makeScene(objects: Record<string, unknown>): Scene {
  return {
    version: 1,
    revision: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    screens: {},
    objects,
    screenOrder: [],
    metadata: { name: "Test", tags: [] },
  };
}

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

async function setupScene(testDir: string, sceneId: string, objects: Record<string, unknown>) {
  const intentDir = resolve(testDir, ".intent");
  const scenesDir = resolve(intentDir, "scenes");
  const locksDir = resolve(intentDir, "locks");
  await fs.mkdir(scenesDir, { recursive: true });
  await fs.mkdir(locksDir, { recursive: true });
  await fs.writeFile(resolve(scenesDir, `${sceneId}.json`), JSON.stringify(makeScene(objects), null, 0));
  await fs.writeFile(
    resolve(locksDir, `${sceneId}.locks.json`),
    JSON.stringify({ version: 1, lockedObjects: [], updatedAt: new Date().toISOString() }, null, 0)
  );
}

async function readScene(testDir: string, sceneId: string) {
  const content = await fs.readFile(resolve(testDir, ".intent", "scenes", `${sceneId}.json`), "utf-8");
  return JSON.parse(content);
}

describe("Multi-process concurrency (real OS processes)", () => {
  let children: Set<NodeJS.ChildProcess> = new Set();
  let testDir: string = "";

  beforeEach(() => {
    children = new Set();
    testDir = resolve(__dirname, `../../../.test-mp-${randomUUID().slice(0, 8)}`);
  });

  afterEach(async () => {
    try {
      // Preserve worker logs on failure for debugging
      try {
        const entries = await fs.readdir(testDir);
        for (const entry of entries) {
          if (entry.startsWith(".worker-") && entry.endsWith(".log")) {
            const src = resolve(testDir, entry);
            const dest = resolve(".test-mp-vitest-debug", entry);
            try {
              await fs.mkdir(".test-mp-vitest-debug", { recursive: true });
              await fs.cp(src, dest, { force: true });
            } catch {
              // ignore copy errors
            }
          }
        }
      } catch {
        // ignore
      }
      // Kill any still-running worker processes (zombie scene-lock leak guard)
      for (const ch of children) {
        try {
          ch.kill("SIGTERM");
          await new Promise((r) => setTimeout(r, 100));
          ch.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("4 procs on different objects: all succeed, final revision = 1 + total writes, every value present", async () => {
    const sceneId = genId("s");
    const objIds = [genId("o"), genId("o"), genId("o"), genId("o")];

    const objects: Record<string, unknown> = {};
    objIds.forEach((id, i) => {
      objects[id] = makeObject(id, `initial${i + 1}`);
    });
    await setupScene(testDir, sceneId, objects);

    const preScene = await readScene(testDir, sceneId);
    const expectedContent: Record<string, string> = {};
    objIds.forEach((id) => {
      expectedContent[id] = (preScene.objects[id] as { props: { content: string } }).props.content;
    });

    const workers = objIds.map((id, i) => {
      const ch = spawn("node", [workerPath, testDir, sceneId, id, `updated${String.fromCharCode(65 + i)}`, "0", expectedContent[id], String(i)]);
      children.add(ch);
      let stdout = "";
      ch.stdout.on("data", (d) => (stdout += d.toString()));
      ch.stderr.on("data", (d) => {
        if (!children._stderr) children._stderr = "";
        children._stderr += d.toString();
      });
      return new Promise<{ success: boolean; revision: number; error?: string }>((resolve) => {
        ch.on("close", () => {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ success: false, error: stdout || "parse error: " + (children._stderr || "") });
          }
        });
      });
    });

    const results = await Promise.all(workers);

    for (const r of results) {
      if (!r.success) {
        console.error("WORKER FAIL:", r.error);
      }
    }

    const successes = results.filter((r) => r.success);
    expect(successes.length).toBe(4);

    const scene = await readScene(testDir, sceneId);
    expect(scene.revision).toBe(4);

    objIds.forEach((id, i) => {
      expect(scene.objects[id].props.content).toBe(`updated${String.fromCharCode(65 + i)}`);
    });
  });

  it("4 procs on SAME object", async () => {
    const sceneId = genId("s");
    const objA = genId("o");

    const objects: Record<string, unknown> = {};
    objects[objA] = makeObject(objA, "initial");
    await setupScene(testDir, sceneId, objects);

    const preScene = await readScene(testDir, sceneId);
    const expectedContent = (preScene.objects[objA] as { props: { content: string } }).props.content;

    const workers = ["value1", "value2", "value3", "value4"].map((value, i) => {
      const ch = spawn("node", [workerPath, testDir, sceneId, objA, value, "0", expectedContent, String(i)]);
      children.add(ch);
      let stdout = "";
      ch.stdout.on("data", (d) => (stdout += d.toString()));
      return new Promise<{ success: boolean; revision: number; error?: string }>((resolve) => {
        ch.on("close", () => {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ success: false, error: stdout || "parse error" });
          }
        });
      });
    });
    const results = await Promise.all(workers);

    const successes = results.filter((r) => r.success);

    // All 4 workers must eventually succeed (retries handle contention)
    expect(successes.length).toBe(4 * N_SUCCESS_PER_WORKER);

    // Every success increases revision by exactly 1
    const successRevisions = successes.map((r) => r.revision).sort((a, b) => a - b);
    expect(successRevisions[0]).toBe(1);
    for (let i = 1; i < successRevisions.length; i++) {
      expect(successRevisions[i]).toBe(successRevisions[i - 1] + 1);
    }

    // Final revision = total successes (started at 0)
    const scene = await readScene(testDir, sceneId);
    expect(scene.revision).toBe(successes.length);

    // No successful write is lost: final content must be one of the written values
    expect(["value1", "value2", "value3", "value4"]).toContain(scene.objects[objA].props.content);

    // All success results are successes with valid revisions
    for (const r of results) {
      if (r.success) {
        expect(r.revision).toBeGreaterThan(0);
      }
    }
  });
});