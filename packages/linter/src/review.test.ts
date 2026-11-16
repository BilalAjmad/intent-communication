import { describe, it, expect } from "vitest";
import { lintSceneWithRules, lintScene, M1_RULES } from "./index";
import { Scene, SceneObject } from "@intent/schema";

// Review findings 2026-11-16 (linter):
// H2: token-object colors must be contrast-checked (they used to short-circuit to a warning with pass: true).
// M9: unknown ruleIds used to silently return a vacuous pass.

const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function sceneWith(props: Record<string, unknown>, style: Record<string, unknown>): Scene {
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
      [SCREEN]: {
        id: SCREEN,
        type: "screen",
        parentId: null,
        children: [TEXT],
        props: { title: "Root" },
        style: {},
        meta: {},
      } as SceneObject,
      [TEXT]: {
        id: TEXT,
        type: "text",
        parentId: SCREEN,
        children: [],
        props: { content: "Hello", ...props },
        style: { background: "#ffffff", ...style },
        meta: {},
      } as SceneObject,
    },
    screenOrder: [SCREEN],
    metadata: { name: "Lint review", tags: [] },
  };
}

describe("L-CONTRAST — token colors (review 2026-11-16)", () => {
  it("token-on-token with ratio ~1:1 is an ERROR, not a pass", () => {
    const scene = sceneWith(
      { color: { $type: "token", $value: "token.color.warning" } },
      { background: { $type: "token", $value: "token.color.warning" } },
    );
    const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
    const contrast = result.violations.filter((v) => v.ruleId === "L-CONTRAST");
    expect(contrast.some((v) => v.severity === "error")).toBe(true);
    expect(result.pass).toBe(false);
  });

  it("token text on white background with good contrast passes", () => {
    const scene = sceneWith(
      { color: { $type: "token", $value: "token.color.text.primary" } },
      { background: { $type: "token", $value: "token.color.background" } },
    );
    const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
    expect(result.violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });

  it("plain #hex and 4/8-digit hex resolve (no spurious warnings)", () => {
    const scene = sceneWith(
      { color: "#fff" },
      { background: "#212529" },
    );
    const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
    expect(result.violations.filter((v) => v.severity === "error")).toHaveLength(0);
  });
});

describe("lintSceneWithRules — unknown ids (review 2026-11-16)", () => {
  it("throws on unknown rule ids instead of returning a vacuous pass", () => {
    const scene = sceneWith({}, {});
    expect(() => lintSceneWithRules(scene, ["L-GRIDB"])).toThrow(/Unknown lint rule/);
  });

  it("known ids still work", () => {
    const scene = sceneWith({}, {});
    expect(M1_RULES.map((r) => r.id)).toContain("L-GRID");
    expect(() => lintSceneWithRules(scene, ["L-SCHEMA"])).not.toThrow();
    expect(lintScene(scene, []).pass).toBe(true);
  });
});
