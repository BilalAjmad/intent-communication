import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const coreIndex = resolve("H:\\intent-communication", "packages", "core", "src", "index.ts");

function runTests() {
  try {
    execSync("cd H:\\intent-communication\\packages\\core && pnpm test", { stdio: "pipe", timeout: 60000 });
    return { pass: true, output: "ALL TESTS PASS" };
  } catch (e) {
    return { pass: false, output: e.stdout?.toString() || e.stderr?.toString() || "FAILED" };
  }
}

console.log("=== MUTATION PROOF ===");
console.log("");

// Save original
const original = readFileSync(coreIndex, "utf-8");

// 1. Remove lock check
console.log("1. Removing lock check...");
let modified = original.replace(
  `  // Check locks: touched object or any ancestor locked → E_LOCKED
  const scene = await storage.readScene(sceneId);
  if (!scene) {
    return { success: false, revision: -1, error: ErrorCodes.E_NOT_FOUND };
  }

  const lockedObjects = await lockPort.getLockedObjects(sceneId);

  for (const patch of patches) {
    // Check if the touched object itself is locked
    if (lockedObjects.includes(patch.objectId)) {
      return { success: false, revision: scene.revision, error: ErrorCodes.E_LOCKED };
    }
    // Check if any ancestor is locked
    let current = scene.objects[patch.objectId]?.parentId;
    while (current) {
      if (lockedObjects.includes(current)) {
        return { success: false, revision: scene.revision, error: ErrorCodes.E_LOCKED };
      }
      current = scene.objects[current]?.parentId;
    }
  }`,
  `  const scene = await storage.readScene(sceneId);
  if (!scene) {
    return { success: false, revision: -1, error: ErrorCodes.E_NOT_FOUND };
  }`
);
writeFileSync(coreIndex, modified);
const result1 = runTests();
console.log(`   Lock check removed: ${result1.pass ? "TESTS STILL PASS (UNEXPECTED)" : "TEST FAILED (EXPECTED)"}`);
console.log(`   ${result1.pass ? "FAIL" : "OK"}`);

// Restore
writeFileSync(coreIndex, original);
console.log("   Restored original.");
console.log("");

// 2. Remove conflict check
console.log("2. Removing conflict check...");
modified = original.replace(
  `    if (patch.baseRevision !== scene.revision && !force) {
      return {
        success: false,
        revision: scene.revision,
        error: ErrorCodes.E_CONFLICT,
      };
    }`,
  `    // conflict check removed`
);
writeFileSync(coreIndex, modified);
const result2 = runTests();
console.log(`   Conflict check removed: ${result2.pass ? "TESTS STILL PASS (UNEXPECTED)" : "TEST FAILED (EXPECTED)"}`);
console.log(`   ${result2.pass ? "FAIL" : "OK"}`);

// Restore
writeFileSync(coreIndex, original);
console.log("   Restored original.");
console.log("");

// 3. Remove scope check (path traversal)
console.log("3. Removing scope check (path traversal)...");
const adapterIndex = resolve("H:\\intent-communication", "packages", "adapters-node", "src", "index.ts");
const adapterOriginal = readFileSync(adapterIndex, "utf-8");
modified = adapterOriginal.replace(
  `    if (!resolved.startsWith(resolvedBase)) {
      throw new IntentError(ErrorCodes.E_PATH_TRAVERSAL, "Path traversal attempt detected");
    }`,
  `    // scope check removed`
);
writeFileSync(adapterIndex, modified);
const result3 = runTests();
console.log(`   Scope check removed: ${result3.pass ? "TESTS STILL PASS (UNEXPECTED)" : "TEST FAILED (EXPECTED)"}`);
console.log(`   ${result3.pass ? "FAIL" : "OK"}`);

// Restore
writeFileSync(adapterIndex, adapterOriginal);
console.log("   Restored original.");
console.log("");

console.log("=== MUTATION PROOF COMPLETE ===");