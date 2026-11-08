import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const testDir = process.argv[2];
const workerId = process.argv[3];
const objectId = process.argv[4];
const value = process.argv[5];

const intentDir = resolve(testDir, ".intent");
const scenesDir = resolve(intentDir, "scenes");
const locksDir = resolve(intentDir, "locks");

function readScene() {
  try {
    return JSON.parse(readFileSync(resolve(scenesDir, "default.json"), "utf-8"));
  } catch {
    return null;
  }
}

function writeScene(scene) {
  const tmpPath = resolve(scenesDir, `default.json.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`);
  writeFileSync(tmpPath, JSON.stringify(scene, null, 0));
  // Atomic rename (may fail on Windows, but try)
  try {
    const fs = require("node:fs");
    fs.renameSync(tmpPath, resolve(scenesDir, "default.json"));
  } catch (e) {
    // Fallback: direct write
    writeFileSync(resolve(scenesDir, "default.json"), JSON.stringify(scene, null, 0));
  }
}

function readLocks() {
  try {
    return JSON.parse(readFileSync(resolve(locksDir, "default.locks.json"), "utf-8"));
  } catch {
    return { version: 1, lockedObjects: [], updatedAt: new Date().toISOString() };
  }
}

function writeLocks(locks) {
  writeFileSync(resolve(locksDir, "default.locks.json"), JSON.stringify(locks, null, 0));
}

// Try to acquire lock
const locks = readLocks();
if (locks.lockedObjects.includes(objectId)) {
  process.stdout.write(JSON.stringify({ success: false, error: "E_LOCKED", workerId }));
  process.exit(0);
}
locks.lockedObjects.push(objectId);
writeLocks(locks);

// Read scene, apply patch, write
const scene = readScene();
if (!scene) {
  process.stdout.write(JSON.stringify({ success: false, error: "E_NOT_FOUND", workerId }));
  process.exit(1);
}

scene.objects[objectId].props.content = value;
scene.revision = (scene.revision || 0) + 1;
scene.updatedAt = new Date().toISOString();
writeScene(scene);

// Release lock
const locks2 = readLocks();
const idx = locks2.lockedObjects.indexOf(objectId);
if (idx !== -1) locks2.lockedObjects.splice(idx, 1);
writeLocks(locks2);

process.stdout.write(JSON.stringify({ success: true, revision: scene.revision, workerId, value }));
process.exit(0);