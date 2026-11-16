import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  createStoragePort,
  createLockPort,
  writePipeline,
  ErrorCodes,
} from "./index";
import { Scene } from "@intent/schema";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

const testDir = resolve(__dirname, "../../../.test-mutation-simple");
const sceneId = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const objectId = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const childId = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const scenesDir = resolve(testDir, ".intent", "scenes");

let storage: ReturnType<typeof createStoragePort>;
let lockPort: ReturnType<typeof createLockPort>;

function makeObject(id: string, parentId: string | null, content: string) {
  return {
    id,
    type: "text",
    parentId,
    children: [],
    props: { content },
    style: {},
    meta: {},
    updatedAt: new Date().toISOString(),
  };
}

async function setupScene(objects: Record<string, unknown>) {
  const intentDir = resolve(testDir, ".intent");
  const scenesDir = resolve(intentDir, "scenes");
  const locksDir = resolve(intentDir, "locks");
  await fs.mkdir(scenesDir, { recursive: true });
  await fs.mkdir(locksDir, { recursive: true });
  const scene: Scene = {
    version: 1,
    revision: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    screens: {},
    objects,
    screenOrder: [],
    metadata: { name: "Test", tags: [] },
  };
  await fs.writeFile(resolve(scenesDir, `${sceneId}.json`), JSON.stringify(scene, null, 0));
  await fs.writeFile(resolve(locksDir, `${sceneId}.locks.json`), JSON.stringify({ version: 1, lockedObjects: [], updatedAt: new Date().toISOString() }, null, 0));
}

function patch(objectId: string, value: string, baseRevision = 0, targetObjectId?: string) {
  return {
    id: objectId, sceneId, baseRevision, objectId: targetObjectId || objectId,
    op: "set", path: "props.content", value,
    createdAt: new Date().toISOString(), status: "sent",
  };
}

describe("Mutation check (section F) - behavioral", () => {
  beforeEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    storage = createStoragePort(testDir);
    lockPort = createLockPort(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("M1: Lock check - locked write must fail with E_LOCKED", async () => {
    await setupScene({ [objectId]: makeObject(objectId, null, "initial") });
    await lockPort.acquire(sceneId, objectId);

    const result = await writePipeline(storage, lockPort, sceneId, [patch(objectId, "modified", 0)], { [objectId]: "initial" });
    await lockPort.release(sceneId, objectId);

    expect(result.success).toBe(false);
    expect(result.error).toBe(ErrorCodes.E_LOCKED);
  });

  it("M2: Conflict check - conflicting write must fail with E_CONFLICT", async () => {
    await setupScene({ [objectId]: makeObject(objectId, null, "initial") });

    await writePipeline(storage, lockPort, sceneId, [patch(objectId, "first", 0)]);
    const result = await writePipeline(storage, lockPort, sceneId, [patch(objectId, "second", 0)]);

    expect(result.success).toBe(false);
    expect(result.error).toBe(ErrorCodes.E_CONFLICT);
  });

  it("M3: Scope check - patch path must traverse to target object", async () => {
    await setupScene({ [objectId]: makeObject(objectId, null, "initial") });

    const result = await writePipeline(storage, lockPort, sceneId, [patch(objectId, "modified", 0)]);
    const scene = await storage.readScene(sceneId);

    // Without mutation: path traverses to target → content changes
    // With mutation: pathParts = [] → no traversal → content unchanged
    expect(scene.objects[objectId].props.content).toBe("modified");
    expect(result.success).toBe(true);
  });

  it("M4: Descendant-lock check - descendant write with locked ancestor must fail with E_LOCKED", async () => {
    await setupScene({
      [objectId]: makeObject(objectId, null, "parent"),
      [childId]: makeObject(childId, objectId, "child"),
    });
    await lockPort.acquire(sceneId, objectId);

    const result = await writePipeline(storage, lockPort, sceneId, [patch(childId, "modified-child", 0)], { [childId]: "child" });
    await lockPort.release(sceneId, objectId);

    expect(result.success).toBe(false);
    expect(result.error).toBe(ErrorCodes.E_LOCKED);
  });

  it("M5: Schema validation - invalid scene throws IntentError E_INVALID_SCENE from readScene", async () => {
    await setupScene({ [objectId]: makeObject(objectId, null, "initial") });

    // Write an invalid scene directly (valid JSON, missing required structure)
    const invalidScene = {
      version: 1,
      revision: 0,
      createdAt: "",
      updatedAt: "",
      screens: {},
      objects: "not-an-object", // invalid: objects must be an object, not a string
      screenOrder: [],
      metadata: { name: "Test", tags: [] },
    };
    await fs.writeFile(
      resolve(scenesDir, `${sceneId}.json`),
      JSON.stringify(invalidScene),
      "utf-8"
    );

    // A corrupt scene on disk is NOT "absent": it throws loudly with a code
    // instead of being laundered into null (which let callers silently treat
    // a broken project as empty and overwrite it).
    try {
      await storage.readScene(sceneId);
      throw new Error("expected IntentError");
    } catch (err) {
      expect((err as { code?: string }).code).toBe("E_INVALID_SCENE");
    }
  });
});
