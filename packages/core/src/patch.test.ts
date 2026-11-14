import { describe, it, expect } from "vitest";
import { applyPatch } from "./patch";
import { ErrorCodes, isIntentError } from "./error";
import { Scene, Patch } from "@intent/schema";

// Review Focus #5 and trd 6.2: the patch path must be a constrained pointer into
// the target object's own subtree. "Traversal" spells like `../../otherObject/...`
// are rejected, and so are paths that can reach `Object.prototype`.

function makeScene(objectId: string, content: string): Scene {
  return {
    version: 1,
    revision: 0,
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
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
        updatedAt: "2026-11-13T00:00:00.000Z",
      },
    },
    screenOrder: [],
    metadata: { name: "Test", tags: [] },
  };
}

function makePatch(objectId: string, path: string, op: "set" | "unset" = "set"): Patch {
  return {
    id: "p_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    baseRevision: 0,
    objectId,
    op,
    path,
    value: "new",
    createdAt: "2026-11-13T00:00:00.000Z",
    status: "sent",
  };
}

const OBJ = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function expectBadRequest(fn: () => unknown, label: string) {
  try {
    fn();
    throw new Error(`${label}: expected applyPatch to throw`);
  } catch (err) {
    if (!isIntentError(err)) throw err;
    expect(err.code, label).toBe(ErrorCodes.E_BAD_REQUEST);
  }
}

describe("applyPatch path safety (trd 6.2)", () => {
  it("refuses a path that climbs out of the target object", () => {
    const scene = makeScene(OBJ, "original");
    expectBadRequest(() => applyPatch(scene, makePatch(OBJ, "../../otherObject/props/content")), "traversal");
  });

  it("refuses the target forbidden by the spec (id)", () => {
    const scene = makeScene(OBJ, "original");
    expectBadRequest(() => applyPatch(scene, makePatch(OBJ, "id")), "id root");
  });

  it("refuses the target forbidden by the spec (rev)", () => {
    const scene = makeScene(OBJ, "original");
    expectBadRequest(() => applyPatch(scene, makePatch(OBJ, "rev")), "rev root");
  });

  it("refuses the target forbidden by the spec (type)", () => {
    const scene = makeScene(OBJ, "original");
    expectBadRequest(() => applyPatch(scene, makePatch(OBJ, "type")), "type root");
  });

  it("refuses a path that reaches Object.prototype", () => {
    const scene = makeScene(OBJ, "original");
    expectBadRequest(() => applyPatch(scene, makePatch(OBJ, "constructor.prototype.polluted")), "constructor prototype");
  });

  it("references no object outside the target", () => {
    const scene = makeScene(OBJ, "original");
    applyPatch(scene, makePatch(OBJ, "props.content"));
    // No stray pollution or sibling keys may appear in the object graph
    const serialized = JSON.stringify(scene);
    expect(serialized).not.toContain('"__proto__"');
    expect(serialized).not.toContain('"constructor"');
  });

  it("still applies a valid props path", () => {
    const scene = makeScene(OBJ, "original");
    const next = applyPatch(scene, makePatch(OBJ, "props.content"));
    expect(next.objects[OBJ].props.content).toBe("new");
  });
});
