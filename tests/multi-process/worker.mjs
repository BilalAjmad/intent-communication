import { createStoragePort, createLockPort, writePipeline } from "../../packages/core/dist/index.js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const testDir = process.argv[2];
const sceneId = process.argv[3];
const objectId = process.argv[4];
const value = process.argv[5];
const initialBaseRevision = parseInt(process.argv[6], 10);
const initialExpectedContent = process.argv[7] || undefined;
const workerIndex = process.argv[8] || "0";
const logPath = resolve(testDir, `.worker-${workerIndex}.log`);

function log(msg) {
  try {
    writeFileSync(logPath, `[${Date.now()}] worker-${workerIndex} ${msg}\n`, { flag: "a" });
  } catch {}
}

const storage = createStoragePort(testDir);
const lockPort = createLockPort(storage);

async function main() {
  try {
    log("started");
    const readyPath = resolve(testDir, ".ready");
    const barrierPath = resolve(testDir, ".barrier");

    // Phase 1: Signal readiness
    writeFileSync(`${readyPath}.${workerIndex}`, "ready");
    log("ready");

    // Phase 2: Wait for all 4 workers to be ready
    for (let i = 0; i < 5000; i++) {
      const readyFiles = ["0", "1", "2", "3"].map((idx) => existsSync(`${readyPath}.${idx}`));
      if (readyFiles.every(Boolean)) break;
      await new Promise((r) => setTimeout(r, 5));
    }
    log("barrier crossed");

    // Phase 3: All workers proceed together
    let patchBaseRevision = initialBaseRevision;
    let expectedContentMap = initialExpectedContent ? { [objectId]: initialExpectedContent } : undefined;

    let lastResult = { success: false, revision: -1, error: "unknown" };
    for (let attempt = 0; attempt < 50; attempt++) {
      log(`attempt ${attempt} start baseRevision=${patchBaseRevision}`);
      try {
        const result = await writePipeline(storage, lockPort, sceneId, [
          {
            id: objectId,
            sceneId,
            baseRevision: patchBaseRevision,
            objectId,
            op: "set",
            path: "props.content",
            value,
            createdAt: new Date().toISOString(),
            status: "pending",
          },
        ], false, expectedContentMap);
        log(`attempt ${attempt} result success=${result.success} revision=${result.revision} error=${result.error}`);
        lastResult = result;
        if (result.success) break;
        if (result.error === "E_CONFLICT") {
          await new Promise((r) => setTimeout(r, 10 * (attempt + 1)));
          const scene = JSON.parse(readFileSync(resolve(testDir, ".intent", "scenes", sceneId + ".json"), "utf-8"));
          patchBaseRevision = scene.revision;
          const currentObj = scene.objects[objectId];
          if (currentObj && currentObj.props && currentObj.props.content !== undefined) {
            expectedContentMap = { [objectId]: currentObj.props.content };
          }
          continue;
        }
        if (result.error === "E_LOCKED") {
          await new Promise((r) => setTimeout(r, 10 * (attempt + 1)));
          continue;
        }
        break;
      } catch (e) {
        log(`attempt ${attempt} exception: ${e.message}`);
        lastResult = { success: false, revision: -1, error: e.message };
        break;
      }
    }

    log(`finished: success=${lastResult.success} revision=${lastResult.revision} error=${lastResult.error}`);
    process.stdout.write(JSON.stringify(lastResult));
  } catch (e) {
    process.stdout.write(JSON.stringify({ success: false, revision: -1, error: e.message, stack: e.stack }));
  }
  process.exit(0);
}

main();
