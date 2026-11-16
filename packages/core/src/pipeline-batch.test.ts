import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createStoragePort, createLockPort } from "./ports";
import { writePipeline } from "./pipeline";
import { Scene, Patch } from "@intent/schema";

// Review findings (2026-11-16):
// F1: two patches sharing an ancestor used to self-E_LOCKED (acquire is now re-entrant per process).
// F2: a failing batch must not persist earlier patches (all-or-nothing; pre-batch snapshot drives checks).

const SCENE = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const PARENT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAX";
const CHILD_A = "o_01ARZ3NDEKTSV4RRFFQ69G5FAW";
const CHILD_B = "o_01ARZ3NDEKTSV4RRFFQ69G5FAY";

function makeScene(): Scene {
  return {
    version: 1,
    revision: 0,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    screens: {},
    objects: {
      [PARENT]: {
        id: PARENT,
        type: "container",
        parentId: null,
        children: [CHILD_A, CHILD_B],
        props: { layout: "flex" },
        style: {},
        meta: {},
      },
      [CHILD_A]: {
        id: CHILD_A,
        type: "text",
        parentId: PARENT,
        children: [],
        props: { content: "A" },
        style: {},
        meta: {},
      },
      [CHILD_B]: {
        id: CHILD_B,
        type: "text",
        parentId: PARENT,
        children: [],
        props: { content: "B" },
        style: {},
        meta: {},
      },
    },
    screenOrder: [],
    metadata: { name: "Batch", tags: [] },
  };
}

function patchFor(objectId: string, baseRevision: number, content: string): Patch {
  return {
    id: "p_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    sceneId: SCENE,
    baseRevision,
    objectId,
    op: "set",
    path: "props.content",
    value: content,
    createdAt: "2026-11-16T00:00:00.000Z",
    status: "sent",
  };
}

let dir: string;

beforeEach(async () => {
  dir = resolve(os.tmpdir(), `.test-pipeline-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(dir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(dir, ".intent", "scenes", `${SCENE}.json`), JSON.stringify(makeScene()), "utf-8");
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
});

describe("writePipeline — batch semantics (review 2026-11-16)", () => {
  it("a batch of sibling patches sharing an ancestor all apply (no self-E_LOCKED)", async () => {
    const storage = createStoragePort(dir);
    const lockPort = createLockPort(storage, resolve(dir, ".intent", "tmp"));
    const result = await writePipeline(storage, lockPort, SCENE, [
      patchFor(CHILD_A, 0, "A-updated"),
      patchFor(CHILD_B, 0, "B-updated"),
    ]);
    expect(result.success).toBe(true);
    expect(result.revision).toBe(2);
    const scene = await storage.readScene(SCENE);
    expect(scene?.objects[CHILD_A]?.props.content).toBe("A-updated");
    expect(scene?.objects[CHILD_B]?.props.content).toBe("B-updated");
  }, 15000);

  it("a failing batch persists NOTHING (all-or-nothing)", async () => {
    const storage = createStoragePort(dir);
    const lockPort = createLockPort(storage, resolve(dir, ".intent", "tmp"));

    // Control: a clean batch applies (revision 0 -> 2).
    const control = await writePipeline(storage, lockPort, SCENE, [
      patchFor(CHILD_A, 0, "A-updated"),
      patchFor(CHILD_B, 0, "B-updated"),
    ]);
    expect(control.success).toBe(true);

    // Now a batch where one patch has a stale baseRevision — must fail, and
    // NOTHING from the batch may be written.
    const result = await writePipeline(storage, lockPort, SCENE, [
      patchFor(CHILD_A, 1, "A-should-not-apply"), // stale: scene is at revision 2
      patchFor(CHILD_B, 2, "B-should-not-apply"),
    ]);
    expect(result.success).toBe(false);
    expect(result.error).toBe("E_CONFLICT");

    const scene = await storage.readScene(SCENE);
    expect(scene?.objects[CHILD_A]?.props.content).toBe("A-updated");
    expect(scene?.objects[CHILD_B]?.props.content).toBe("B-updated");
    expect(scene?.revision).toBe(2);
  }, 15000);
});
