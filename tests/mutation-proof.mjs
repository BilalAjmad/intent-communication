import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const pipelineFile = resolve("H:\\intent communication", "packages", "core", "src", "pipeline.ts");
const adapterFile = resolve("H:\\intent communication", "packages", "adapters-node", "src", "index.ts");

function runCoreTests() {
  try {
    execSync("cd H:\\intent communication\\packages\\core && pnpm test", { stdio: "pipe", timeout: 120000 });
    return { pass: true, output: "ALL TESTS PASS" };
  } catch (e) {
    return { pass: false, output: e.stdout?.toString() || e.stderr?.toString() || "FAILED" };
  }
}

function runAdapterTests() {
  try {
    execSync("cd H:\\intent communication\\packages\\adapters-node && pnpm test", { stdio: "pipe", timeout: 120000 });
    return { pass: true, output: "ALL TESTS PASS" };
  } catch (e) {
    return { pass: false, output: e.stdout?.toString() || e.stderr?.toString() || "FAILED" };
  }
}

console.log("=== MUTATION PROOF ===\n");

const originalPipeline = readFileSync(pipelineFile, "utf-8");

// 1. Remove lock check (the acquire loop)
console.log("1. Removing lock check...");
const lockCheckPattern = `  // Acquire object-level locks for touched objects (handles stale locks from dead processes)
  const acquiredPatchLocks: string[] = [];
  try {
    const scene = await storage.readScene(sceneId);
    if (!scene) {
      return { success: false, revision: -1, error: ErrorCodes.E_NOT_FOUND };
    }

    for (const patch of patches) {
      const acquired = await lockPort.acquire(sceneId, patch.objectId);
      if (!acquired) {
        // Release any locks acquired so far in this batch
        for (const released of acquiredPatchLocks.reverse()) {
          await lockPort.release(sceneId, released);
        }
        return { success: false, revision: scene.revision, error: ErrorCodes.E_LOCKED };
      }
      acquiredPatchLocks.push(patch.objectId);
`;
const lockCheckReplacement = `  const acquiredPatchLocks: string[] = [];
  try {
    const scene = await storage.readScene(sceneId);
    if (!scene) {
      return { success: false, revision: -1, error: ErrorCodes.E_NOT_FOUND };
    }
`;
let modified = originalPipeline.replace(lockCheckPattern, lockCheckReplacement);
writeFileSync(pipelineFile, modified);
const result1 = runCoreTests();
console.log(`   Lock check removed: ${result1.pass ? "TESTS STILL PASS (UNEXPECTED)" : "TEST FAILED (EXPECTED)"}`);
console.log(`   ${result1.pass ? "FAIL" : "OK"}`);
writeFileSync(pipelineFile, originalPipeline);
console.log("   Restored original.\n");

// 2. Remove conflict check (baseRevision check)
console.log("2. Removing conflict check...");
const conflictPattern = `      if (patch.baseRevision !== currentScene.revision || changedObjectIds.length > 0) {
        return {
          success: false,
          revision: currentScene.revision,
          error: ErrorCodes.E_CONFLICT,
          details: { changedObjectIds },
        };
      }`;
const conflictReplacement = `      // conflict check removed`;
modified = originalPipeline.replace(conflictPattern, conflictReplacement);
writeFileSync(pipelineFile, modified);
const result2 = runCoreTests();
console.log(`   Conflict check removed: ${result2.pass ? "TESTS STILL PASS (UNEXPECTED)" : "TEST FAILED (EXPECTED)"}`);
console.log(`   ${result2.pass ? "FAIL" : "OK"}`);
writeFileSync(pipelineFile, originalPipeline);
console.log("   Restored original.\n");

// 3. Remove scope check (path traversal)
console.log("3. Removing scope check (path traversal)...");
const adapterOriginal = readFileSync(adapterFile, "utf-8");
modified = adapterOriginal.replace(
  `    if (!resolved.startsWith(resolvedBase)) {
      throw new IntentError(ErrorCodes.E_PATH_TRAVERSAL, "Path traversal attempt detected");
    }`,
  `    // scope check removed`
);
writeFileSync(adapterFile, modified);
const result3 = runAdapterTests();
console.log(`   Scope check removed: ${result3.pass ? "TESTS STILL PASS (UNEXPECTED)" : "TEST FAILED (EXPECTED)"}`);
console.log(`   ${result3.pass ? "FAIL" : "OK"}`);
writeFileSync(adapterFile, adapterOriginal);
console.log("   Restored original.\n");

console.log("=== MUTATION PROOF COMPLETE ===");
