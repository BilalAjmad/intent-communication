import { describe, it, expect } from "vitest";
import { exportToHtml } from "./index";
import { sanitizeUrl, sanitizeCssValue, buildCsp, sanitizeNonce, safeClassToken } from "./sanitize";
import { Scene, SceneObject } from "@intent/schema";

// Review findings 2026-11-16 (engine): the exporter used to crash on schema-valid
// input (non-string props), recurse forever on cyclic graphs, and leak an embeddable
// click channel. Covered here against the real export path.

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const PARENT = "o_01ARZ3NDEKTSV4RRFFQ69G5FVX";

function makeScene(textProps: Record<string, unknown>): Scene {
  return {
    version: 1,
    revision: 0,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN,
        type: "screen",
        parentId: null,
        children: [TEXT],
        props: { title: "Root" },
        style: {},
        meta: {},
      } as SceneObject,
    },
    objects: {
      [TEXT]: {
        id: TEXT,
        type: "text",
        parentId: SCREEN,
        children: [],
        props: textProps,
        style: {},
        meta: {},
      } as SceneObject,
    },
    screenOrder: [SCREEN],
    metadata: { name: "Review", tags: [] },
  };
}

describe("exportToHtml â€” review 2026-11-16", () => {
  it("non-string text content is coerced, never crashes", () => {
    const scene = makeScene({ content: 42 });
    const html = exportToHtml(scene);
    expect(html).toContain(">42<");
  });

  it("boolean/null content is coerced, never crashes", () => {
    const scene = makeScene({ content: true });
    expect(() => exportToHtml(scene)).not.toThrow();
    expect(exportToHtml(makeScene({ content: null }))).not.toContain("null<");
  });

  it("a cyclic scene graph throws E_LIMIT instead of overflowing the stack", () => {
    // TEXT -> PARENT -> TEXT (both reachable from the screen); the depth cap catches it.
    const scene = makeScene({ content: "x" });
    scene.screens[SCREEN].children = [PARENT];
    scene.objects[PARENT] = {
      id: PARENT,
      type: "container",
      parentId: SCREEN,
      children: [TEXT],
      props: {},
      style: {},
      meta: {},
    } as SceneObject;
    scene.objects[TEXT].parentId = PARENT;
    scene.objects[TEXT].children = [PARENT];
    try {
      exportToHtml(scene as Scene);
      throw new Error("expected exportToHtml to throw");
    } catch (err) {
      expect((err as { code?: string }).code).toBe("E_LIMIT");
    }
  });
});

describe("sanitize â€” review 2026-11-16", () => {
  it("protocol-relative URLs are dropped (even with no '..' and no scheme)", () => {
    expect(sanitizeUrl("//evil.example.com/x.png")).toBe("");
  });

  it("sanitizeCssValue drops values containing CSS comments", () => {
    expect(sanitizeCssValue("red /* sneaky */ }x{")).toBe("");
    expect(sanitizeCssValue("var(--x) /* eaten")).toBe("");
  });

  it("buildCsp ignores an invalid nonce instead of interpolating it", () => {
    const csp = buildCsp("bad'; script-src https:");
    expect(csp).not.toContain("https:");
    expect(csp).not.toContain("bad");
    expect(sanitizeNonce("ok_123-XYZ")).toBe("ok_123-XYZ");
  });

  it("safeClassToken still falls back on invalid input", () => {
    expect(safeClassToken("ok class", "fallback")).toBe("fallback");
    expect(safeClassToken("primary", "fallback")).toBe("primary");
  });
});
