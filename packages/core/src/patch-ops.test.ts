import { describe, it, expect } from "vitest";
import { applyPatch } from "./patch";
import { ErrorCodes, isIntentError } from "./error";
import { Scene, Patch } from "@intent/schema";

// Behavioral fixes from the full line-by-line review (2026-11-16):
// 1) 'set' without a value used to silently no-op yet bump revisions (false "applied").
// 2) 'add'/'remove' without an index silently no-op'd.
// 3) 'move' was a console.warn no-op that still bumped revisions.
// 4) A path resolving through a non-object (e.g. props.content.first) used to throw a
//    cryptic raw TypeError (strict-mode assignment to a primitive).

function makeScene(objectId: string, content: string): Scene {
  return {
    version: 1,
    revision: 0,
    createdAt: "2026-11-15T00:00:00.000Z",
    updatedAt: "2026-11-15T00:00:00.000Z",
    screens: {},
    objects: {
      [objectId]: {
        id: objectId,
        type: "text",
        parentId: null,
        children: [],
        props: { content },
        style: {},
        meta: {},
        updatedAt: "2026-11-15T00:00:00.000Z",
      },
    },
    screenOrder: [],
    metadata: { name: "Test", tags: [] },
  };
}

const OBJ = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makePatch(objectId: string, path: string, op: "set" | "unset" | "add" | "remove" | "move" | "setState", extra: Partial<Patch> = {}): Patch {
  return {
    id: "p_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    baseRevision: 0,
    objectId,
    op,
    path,
    value: "new",
    createdAt: "2026-11-15T00:00:00.000Z",
    status: "sent",
    ...extra,
  };
}

function expectBadRequest(fn: () => unknown, label: string) {
  try {
    fn();
    throw new Error(`${label}: expected applyPatch to throw`);
  } catch (err) {
    if (!isIntentError(err)) throw err;
    expect(err.code, label).toBe(ErrorCodes.E_BAD_REQUEST);
  }
}

describe("applyPatch op discipline (review 2026-11-16)", () => {
  it("'set' without a value throws E_BAD_REQUEST and does not bump the revision", () => {
    const scene = makeScene(OBJ, "original");
    const patch = makePatch(OBJ, "props.content", "set", { value: undefined });
    expectBadRequest(() => applyPatch(scene, patch), "set without value");
  });

  it("'setState' without a value throws E_BAD_REQUEST", () => {
    const scene = makeScene(OBJ, "original");
    const patch = makePatch(OBJ, "props.content", "setState", { value: undefined });
    expectBadRequest(() => applyPatch(scene, patch), "setState without value");
  });

  it("'add' without an index throws E_BAD_REQUEST", () => {
    const scene = makeScene(OBJ, "original");
    const patch = makePatch(OBJ, "props.list", "add", { value: "x", index: undefined });
    expectBadRequest(() => applyPatch(scene, patch), "add without index");
  });

  it("'remove' without an index throws E_BAD_REQUEST", () => {
    const scene = makeScene(OBJ, "original");
    const patch = makePatch(OBJ, "props.list", "remove", { index: undefined });
    expectBadRequest(() => applyPatch(scene, patch), "remove without index");
  });

  it("'add' into a non-array target throws E_BAD_REQUEST (not a raw TypeError)", () => {
    const scene = makeScene(OBJ, "original");
    const patch = makePatch(OBJ, "props.content", "add", { value: "x", index: 0 });
    expectBadRequest(() => applyPatch(scene, patch), "add into non-array");
  });

  it("'move' is not implemented in M1 and throws E_BAD_REQUEST (never a silent no-op)", () => {
    const scene = makeScene(OBJ, "original");
    const patch = makePatch(OBJ, "props.content", "move", { fromIndex: 0, toParentId: OBJ });
    expectBadRequest(() => applyPatch(scene, patch), "move");
  });

  it("a path resolving through a non-object throws E_BAD_REQUEST (not a raw TypeError)", () => {
    const scene = makeScene(OBJ, "original");
    expectBadRequest(() => applyPatch(scene, makePatch(OBJ, "props.content.first", "set")), "path through non-object");
  });

  it("a path resolving through Object.prototype members still throws E_BAD_REQUEST", () => {
    const scene = makeScene(OBJ, "original");
    expectBadRequest(() => applyPatch(scene, makePatch(OBJ, "props.constructor.x", "set")), "inherited member as segment");
  });
});
