import { createStoragePort, createLockPort, writePipeline } from "../../packages/core/dist/index.js";
import { resolve } from "node:path";

const testDir = process.argv[2];
const sceneId = process.argv[3];
const objectId = process.argv[4];
const value = process.argv[5];
const baseRevision = parseInt(process.argv[6], 10);
const killAfterMs = process.argv[7] ? parseInt(process.argv[7], 10) : undefined;

const storage = createStoragePort(testDir);
const lockPort = createLockPort(storage);

async function main() {
  try {
    if (killAfterMs) {
      // Acquire the trd 9.2 scene lock and HOLD it, then self-SIGKILL while holding it
      const acquired = await lockPort.acquireSceneLock(sceneId);
      process.stdout.write(JSON.stringify({ acquired, pid: process.pid, stage: "locked" }));
      setTimeout(() => {
        process.kill(process.pid, "SIGKILL");
      }, killAfterMs);
      await new Promise(() => {});
    } else {
      const patch = {
        id: objectId,
        sceneId,
        baseRevision,
        objectId,
        op: "set",
        path: "props.content",
        value,
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      const expectedContentMap = { [objectId]: "initial" };
      const result = await writePipeline(storage, lockPort, sceneId, [patch], expectedContentMap);
      process.stdout.write(JSON.stringify({ success: result.success, revision: result.revision, error: result.error, pid: process.pid }));
    }
  } catch (e) {
    process.stdout.write(JSON.stringify({ success: false, revision: -1, error: e.message, pid: process.pid }));
  }
  process.exit(0);
}

main();
