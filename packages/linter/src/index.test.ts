import { describe, it, expect } from "vitest";
import {
  lintScene,
  lintSceneWithRules,
} from "./index";
import { Scene, Screen, Text, Button, Container } from "@intent/schema";

function createBaseScene(overrides: Partial<Scene> = {}): Scene {
  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-02T22:38:00.000Z",
    updatedAt: "2026-11-02T22:38:00.000Z",
    screens: {},
    objects: {},
    screenOrder: [],
    metadata: { name: "Test", tags: [] },
    ...overrides,
  };
}

function createScreen(id: string, title: string = "Test Screen"): Screen {
  return {
    id,
    type: "screen",
    parentId: null,
    children: [],
    props: { title, width: 1280, height: 720 },
    style: {},
    meta: {},
  };
}

function createText(id: string, parentId: string, content: string, color?: { $type: "token"; $value: string }): Text {
  return {
    id,
    type: "text",
    parentId,
    children: [],
    props: { content, fontSize: 16, color: color ?? { $type: "token", $value: "token.color.text.primary" } },
    style: {},
    meta: {},
  };
}

function createButton(id: string, parentId: string, label: string, style: Record<string, unknown> = {}): Button {
  return {
    id,
    type: "button",
    parentId,
    children: [],
    props: { label, variant: "primary" },
    style: { 
      minWidth: 44, 
      minHeight: 44,
      ...style 
    },
    meta: {},
  };
}

function createContainer(id: string, parentId: string | null, children: string[] = []): Container {
  return {
    id,
    type: "container",
    parentId,
    children,
    props: { layout: "flex", direction: "column" },
    style: {},
    meta: {},
  };
}

describe("Linter - M1 Rules", () => {
  describe("L-SCHEMA: Schema Validation", () => {
    it("passes with valid screen", () => {
      const scene = createBaseScene({
        objects: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-SCHEMA"]);
      expect(result.pass).toBe(true);
    });

    it("fails screen with non-null parentId", () => {
      const scene = createBaseScene({
        objects: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": {
            ...createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
            parentId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
          },
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-SCHEMA"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-SCHEMA")).toBe(true);
    });

    it("fails object with non-existent parent", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createText(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "o_02ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Hello"
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-SCHEMA"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-SCHEMA")).toBe(true);
    });

    it("accepts a screen as parent (screens live in scene.screens)", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createText(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Hello"
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
        screenOrder: ["s_01ARZ3NDEKTSV4RRFFQ69G5FAV"],
      });
      scene.screens["s_01ARZ3NDEKTSV4RRFFQ69G5FAV"].children = ["o_01ARZ3NDEKTSV4RRFFQ69G5FAV"];
      const result = lintSceneWithRules(scene, ["L-SCHEMA"]);
      expect(result.pass).toBe(true);
    });
  });

  describe("L-GRID: 4px Grid Alignment", () => {
    it("passes with 4px aligned values", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createText(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Hello"
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      scene.objects["o_01ARZ3NDEKTSV4RRFFQ69G5FAV"].style = { margin: 16, padding: 8 };
      const result = lintSceneWithRules(scene, ["L-GRID"]);
      expect(result.pass).toBe(true);
    });

    it("fails with non-4px aligned value", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createText(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Hello"
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      scene.objects["o_01ARZ3NDEKTSV4RRFFQ69G5FAV"].style = { margin: 15 };
      const result = lintSceneWithRules(scene, ["L-GRID"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-GRID")).toBe(true);
    });
  });

  describe("L-CONTRAST: WCAG AA Contrast Ratio", () => {
    it("passes with token color and background meeting WCAG AA", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createText(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Hello",
            { $type: "token", $value: "token.color.text.primary" }
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      scene.objects["o_01ARZ3NDEKTSV4RRFFQ69G5FAV"].style = { 
        background: { $type: "token", $value: "token.color.background" } 
      };
      const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
      expect(result.pass).toBe(true);
    });

    it("fails #777777 on #ffffff (ratio 4.48:1 < 4.5)", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": {
            ...createText("o_01ARZ3NDEKTSV4RRFFQ69G5FAV", "s_01ARZ3NDEKTSV4RRFFQ69G5FAV", "Hello"),
            props: { content: "Hello", fontSize: 16, color: "#777777" },
            style: { background: "#ffffff" },
            meta: {},
          },
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-CONTRAST")).toBe(true);
      expect(result.violations[0].message).toContain("4.48");
    });

    it("passes #767676 on #ffffff (ratio 4.54:1 >= 4.5)", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": {
            ...createText("o_01ARZ3NDEKTSV4RRFFQ69G5FAV", "s_01ARZ3NDEKTSV4RRFFQ69G5FAV", "Hello"),
            props: { content: "Hello", fontSize: 16, color: "#767676" },
            style: { background: "#ffffff" },
            meta: {},
          },
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
      expect(result.pass).toBe(true);
    });

    it("passes large text per WCAG (>=24px, or >=18.66px bold) with 3:1 ratio", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": {
            ...createText("o_01ARZ3NDEKTSV4RRFFQ69G5FAV", "s_01ARZ3NDEKTSV4RRFFQ69G5FAV", "Hello"),
            props: { content: "Hello", fontSize: 24, color: "#888888" },
            style: { background: "#ffffff" },
            meta: {},
          },
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
      expect(result.pass).toBe(true);
    });

    it("18px regular text is NOT large text (3:1 fails, 4.5:1 required)", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": {
            ...createText("o_01ARZ3NDEKTSV4RRFFQ69G5FAV", "s_01ARZ3NDEKTSV4RRFFQ69G5FAV", "Hello"),
            props: { content: "Hello", fontSize: 18, fontWeight: 400, color: "#888888" },
            style: { background: "#ffffff" },
            meta: {},
          },
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
      expect(result.pass).toBe(false);
    });

    it("fails non-token color or background", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createText(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Hello",
            "#ff0000"
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      scene.objects["o_01ARZ3NDEKTSV4RRFFQ69G5FAV"].style = { background: "#ffffff" };
      const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-CONTRAST")).toBe(true);
    });
  });

  describe("L-TOUCH: Touch Target 44px", () => {
    it("fails button with width < 44px", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createButton(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Click",
            { minWidth: 32, minHeight: 44 }
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-TOUCH"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-TOUCH")).toBe(true);
    });

    it("fails button with height < 44px", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createButton(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Click",
            { minWidth: 44, minHeight: 32 }
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-TOUCH"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-TOUCH")).toBe(true);
    });

    it("passes button with 44px touch target", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createButton(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Click"
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-TOUCH"]);
      expect(result.pass).toBe(true);
    });
  });

  describe("L-LOCK: Lock Validation", () => {
    it("passes with no locked objects", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createText(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Hello"
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-LOCK"], []);
      expect(result.pass).toBe(true);
    });

    it("fails when object is locked", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createText(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Hello"
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-LOCK"], ["o_01ARZ3NDEKTSV4RRFFQ69G5FAV"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-LOCK")).toBe(true);
    });
  });

  describe("Full lint pass", () => {
    it("passes clean scene", () => {
      const screenId = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
      const containerId = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
      const textId = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
      const buttonId = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId, "Home", [containerId]) },
        objects: {
          [screenId]: createScreen(screenId, "Home", [containerId]),
          [containerId]: createContainer(containerId, screenId, [textId, buttonId]),
          [textId]: createText(textId, containerId, "Welcome", { $type: "token", $value: "token.color.text.primary" }),
          [buttonId]: createButton(buttonId, containerId, "Get Started"),
        },
        screenOrder: [screenId],
      });
      scene.objects[textId].style = { 
        background: { $type: "token", $value: "token.color.background" } 
      };
      scene.objects[containerId].style = { margin: 16, padding: 8 };
      scene.objects[textId].style = { margin: 8 };
      scene.objects[buttonId].style = { margin: 8, minWidth: 44, minHeight: 44 };
      scene.objects[buttonId].states = { loading: { style: { opacity: 0.6 } } };

      const result = lintScene(scene, []);
      expect(result.pass).toBe(true);
    });

    it("collects all violations", () => {
      const scene = createBaseScene({
        objects: {
          "o_01ARZ3NDEKTSV4RRFFQ69G5FAV": createText(
            "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            "Hello",
            "#ff0000"
          ),
        },
        screens: {
          "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": createScreen("s_01ARZ3NDEKTSV4RRFFQ69G5FAV"),
        },
      });
      scene.objects["o_01ARZ3NDEKTSV4RRFFQ69G5FAV"].style = { background: "#ffffff" };
      const result = lintScene(scene, []);
      expect(result.pass).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
});