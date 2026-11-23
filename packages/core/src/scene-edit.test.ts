import { describe, expect, it } from "vitest";
import { Scene, SceneSchema } from "@intent/schema";
import { createObject, deleteObject, newObjectId } from "./scene-edit";
import { ErrorCodes, isIntentError } from "./error";

const NOW = "2026-11-22T10:00:00.000Z";

function emptyScene(): Scene {
  return {
    version: 1,
    revision: 0,
    createdAt: NOW,
    updatedAt: NOW,
    screens: {},
    objects: {},
    components: [],
    screenOrder: [],
    metadata: { name: "Test", tags: [], keyframes: {} },
  };
}

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
    throw new Error(`expected applyPatch to throw ${code}`);
  } catch (err) {
    if (!isIntentError(err)) throw err;
    expect(err.code).toBe(code);
  }
}

describe("newObjectId", () => {
  it("uses the s_ prefix for screens and o_ elsewhere", () => {
    expect(newObjectId("screen")).toMatch(/^s_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(newObjectId("text")).toMatch(/^o_[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("is unique across calls", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newObjectId("text")));
    expect(ids.size).toBe(200);
  });
});

describe("createObject", () => {
  it("creates the first screen and appends it to screenOrder", () => {
    const scene = emptyScene();
    const { scene: next, objectId, object } = createObject(
      scene,
      { sceneId: "default", type: "screen", props: { title: "Home", width: 390, height: 844 } },
      NOW,
    );

    expect(next.revision).toBe(1);
    expect(next.screens[objectId]?.type).toBe("screen");
    expect(next.screens[objectId]?.props.title).toBe("Home");
    expect(next.screenOrder).toEqual([objectId]);
    expect(object.rev).toBe(1);
    expect(SceneSchema.safeParse(next).success).toBe(true);
    // input scene is untouched
    expect(scene.revision).toBe(0);
    expect(scene.screens).toEqual({});
  });

  it("creates a text object under a screen and links the parent's children", () => {
    const scene = emptyScene();
    const screen = createObject(scene, { sceneId: "default", type: "screen" }, NOW);
    const text = createObject(screen.scene, {
      sceneId: "default",
      type: "text",
      parentId: screen.objectId,
      props: { content: "Salon booking" },
    }, NOW);

    expect(text.scene.objects[text.objectId]?.parentId).toBe(screen.objectId);
    expect(text.scene.screens[screen.objectId]?.children).toEqual([text.objectId]);
    expect(text.scene.revision).toBe(2);
    expect(SceneSchema.safeParse(text.scene).success).toBe(true);
  });

  it("supports nesting inside a container and respects the insertion index", () => {
    const scene = emptyScene();
    const screen = createObject(scene, { sceneId: "default", type: "screen" }, NOW);
    const container = createObject(screen.scene, {
      sceneId: "default", type: "container", parentId: screen.objectId, props: { layout: "column" },
    }, NOW);
    const first = createObject(container.scene, {
      sceneId: "default", type: "button", parentId: container.objectId, props: { label: "A" },
    }, NOW);
    const second = createObject(first.scene, {
      sceneId: "default", type: "button", parentId: container.objectId, props: { label: "B" }, index: 0,
    }, NOW);

    expect(second.scene.objects[container.objectId]?.children).toEqual([second.objectId, first.objectId]);
  });

  it("requires a parentId for non-screen objects", () => {
    expectCode(() => createObject(emptyScene(), { sceneId: "default", type: "text" }, NOW), ErrorCodes.E_BAD_REQUEST);
  });

  it("rejects a parent for a screen", () => {
    const scene = emptyScene();
    const screen = createObject(scene, { sceneId: "default", type: "screen" }, NOW);
    expectCode(
      () => createObject(screen.scene, { sceneId: "default", type: "screen", parentId: screen.objectId }, NOW),
      ErrorCodes.E_BAD_REQUEST,
    );
  });

  it("rejects an id whose prefix does not match the type", () => {
    expectCode(
      () => createObject(emptyScene(), { sceneId: "default", type: "screen", id: newObjectId("text") }, NOW),
      ErrorCodes.E_BAD_REQUEST,
    );
    const screen = createObject(emptyScene(), { sceneId: "default", type: "screen" }, NOW);
    expectCode(
      () => createObject(screen.scene, {
        sceneId: "default", type: "text", parentId: screen.objectId, id: newObjectId("screen"),
      }, NOW),
      ErrorCodes.E_BAD_REQUEST,
    );
  });

  it("rejects a duplicate id", () => {
    const screen = createObject(emptyScene(), { sceneId: "default", type: "screen" }, NOW);
    expectCode(
      () => createObject(screen.scene, { sceneId: "default", type: "screen", id: screen.objectId }, NOW),
      ErrorCodes.E_BAD_REQUEST,
    );
  });

  it("rejects a missing parent", () => {
    expectCode(
      () => createObject(emptyScene(), {
        sceneId: "default", type: "text", parentId: newObjectId("screen"),
      }, NOW),
      ErrorCodes.E_NOT_FOUND,
    );
  });

  it("rejects a parent that cannot contain children", () => {
    const screen = createObject(emptyScene(), { sceneId: "default", type: "screen" }, NOW);
    const text = createObject(screen.scene, {
      sceneId: "default", type: "text", parentId: screen.objectId,
    }, NOW);
    expectCode(
      () => createObject(text.scene, { sceneId: "default", type: "button", parentId: text.objectId }, NOW),
      ErrorCodes.E_BAD_REQUEST,
    );
  });

  it("allows multiple children under one screen", () => {
    const screen = createObject(emptyScene(), { sceneId: "default", type: "screen" }, NOW);
    const a = createObject(screen.scene, { sceneId: "default", type: "text", parentId: screen.objectId, props: { content: "a" } }, NOW);
    const b = createObject(a.scene, { sceneId: "default", type: "text", parentId: screen.objectId, props: { content: "b" } }, NOW);
    expect(b.scene.screens[screen.objectId]?.children).toHaveLength(2);
  });
});

describe("deleteObject", () => {
  it("removes an object and detaches it from its parent", () => {
    const screen = createObject(emptyScene(), { sceneId: "default", type: "screen" }, NOW);
    const text = createObject(screen.scene, {
      sceneId: "default", type: "text", parentId: screen.objectId,
    }, NOW);

    const { scene: next, removed } = deleteObject(text.scene, { sceneId: "default", objectId: text.objectId }, NOW);
    expect(removed).toEqual([text.objectId]);
    expect(next.objects[text.objectId]).toBeUndefined();
    expect(next.screens[screen.objectId]?.children).toEqual([]);
    expect(next.revision).toBe(3);
    expect(SceneSchema.safeParse(next).success).toBe(true);
  });

  it("removes the whole subtree", () => {
    const screen = createObject(emptyScene(), { sceneId: "default", type: "screen" }, NOW);
    const container = createObject(screen.scene, {
      sceneId: "default", type: "container", parentId: screen.objectId,
    }, NOW);
    const button = createObject(container.scene, {
      sceneId: "default", type: "button", parentId: container.objectId,
    }, NOW);

    const { scene: next, removed } = deleteObject(button.scene, {
      sceneId: "default", objectId: container.objectId,
    }, NOW);
    expect(new Set(removed)).toEqual(new Set([container.objectId, button.objectId]));
    expect(next.objects[container.objectId]).toBeUndefined();
    expect(next.objects[button.objectId]).toBeUndefined();
    expect(next.screens[screen.objectId]?.children).toEqual([]);
    expect(SceneSchema.safeParse(next).success).toBe(true);
  });

  it("removes a screen, its subtree, and its screenOrder entry", () => {
    const first = createObject(emptyScene(), { sceneId: "default", type: "screen" }, NOW);
    const second = createObject(first.scene, { sceneId: "default", type: "screen" }, NOW);
    const text = createObject(second.scene, {
      sceneId: "default", type: "text", parentId: first.objectId,
    }, NOW);

    const { scene: next } = deleteObject(text.scene, { sceneId: "default", objectId: first.objectId }, NOW);
    expect(next.screens[first.objectId]).toBeUndefined();
    expect(next.objects[text.objectId]).toBeUndefined();
    expect(next.screenOrder).toEqual([second.objectId]);
    expect(SceneSchema.safeParse(next).success).toBe(true);
  });

  it("rejects an unknown object", () => {
    expectCode(
      () => deleteObject(emptyScene(), { sceneId: "default", objectId: newObjectId("text") }, NOW),
      ErrorCodes.E_NOT_FOUND,
    );
  });
});
