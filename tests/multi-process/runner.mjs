import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

const testDir = process.argv[2] || "H:\\intent-communication\\.test-mp";
const mode = process.argv[3] || "different"; // "different" or "same"

const workerPath = resolve("H:\\intent-communication", "tests", "multi-process", "worker.mjs");

async function setup() {
  const intentDir = resolve(testDir, ".intent");
  const scenesDir = resolve(intentDir, "scenes");
  const locksDir = resolve(intentDir, "locks");
  await fs.mkdir(scenesDir, { recursive: true });
  await fs.mkdir(locksDir, { recursive: true });

  const obj1 = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
  const obj2 = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
  const obj3 = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d";
  const obj4 = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5e";

  const objects = {};
  [obj1, obj2, obj3, obj4].forEach((id, i) => {
    objects[id] = {
      id,
      type: "text",
      parentId: null,
      children: [],
      props: { content: `initial${i + 1}` },
      style: {},
      meta: {},
    };
  });

  const scene = {
    version: 1,
    revision: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    screens: {},
    objects,
    screenOrder: [],
    metadata: { name: "Test", tags: [] },
  };

  await fs.writeFile(resolve(scenesDir, "default.json"), JSON.stringify(scene, null, 0));
  await fs.writeFile(resolve(locksDir, "default.locks.json"), JSON.stringify({ version: 1, lockedObjects: [], updatedAt: new Date().toISOString() }, null, 0));
}

function runWorker(objectId, value) {
  return new Promise((resolve) => {
    const child = spawn("node", [workerPath, testDir, objectId, objectId, value], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });

    child.on("close", (code) => {
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ success: false, error: stderr || stdout || "parse error", code });
      }
    });
  });
}

async function main() {
  await setup();

  const obj1 = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
  const obj2 = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
  const obj3 = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d";
  const obj4 = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5e";

  if (mode === "different") {
    console.log("=== Test: 4 processes on different objects ===");
    const results = await Promise.all([
      runWorker(obj1, "updated1"),
      runWorker(obj2, "updated2"),
      runWorker(obj3, "updated3"),
      runWorker(obj4, "updated4"),
    ]);
    console.log("Results:", JSON.stringify(results, null, 2));

    const scene = JSON.parse(await fs.readFile(resolve(testDir, ".intent", "scenes", "default.json"), "utf-8"));
    console.log("Final revision:", scene.revision);
    console.log("Final objects:");
    for (const [id, obj] of Object.entries(scene.objects)) {
      console.log(`  ${id}: ${obj.props.content}`);
    }
  } else if (mode === "same") {
    console.log("=== Test: 4 processes on same object ===");
    const results = await Promise.all([
      runWorker(obj1, "value1"),
      runWorker(obj1, "value2"),
      runWorker(obj1, "value3"),
      runWorker(obj1, "value4"),
    ]);
    console.log("Results:", JSON.stringify(results, null, 2));

    const scene = JSON.parse(await fs.readFile(resolve(testDir, ".intent", "scenes", "default.json"), "utf-8"));
    console.log("Final revision:", scene.revision);
    console.log("Final content:", scene.objects[obj1].props.content);
  }
}

main().catch(console.error);