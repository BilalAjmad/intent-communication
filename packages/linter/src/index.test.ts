import { describe, it, expect } from "vitest";
import {
  lintScene,
  lintSceneWithRules,
  M1_RULES,
} from "./index";
import { Scene, Screen, Text, Button, Image, Container } from "@intent/schema";

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

function createText(id: string, parentId: string, content: string, color?: any): Text {
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

function createButton(id: string, parentId: string, label: string, style: any = {}): Button {
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

function createImage(id: string, parentId: string, src: string, alt: string = ""): Image {
  return {
    id,
    type: "image",
    parentId,
    children: [],
    props: { src, alt, fit: "cover" },
    style: {},
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
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-SCHEMA"]);
      expect(result.pass).toBe(true);
    });

    it("fails screen with non-null parentId", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": {
            ...createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
            parentId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
          },
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-SCHEMA"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-SCHEMA")).toBe(true);
    });

    it("fails object with non-existent parent", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": createText(
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
            "Hello"
          ),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-SCHEMA"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-SCHEMA")).toBe(true);
    });
  });

  describe("L-GRID: 4px Grid Alignment", () => {
    it("passes with 4px aligned values", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": createText(
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
            "Hello"
          ),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      scene.objects["018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b"].style = { margin: 16, padding: 8 };
      const result = lintSceneWithRules(scene, ["L-GRID"]);
      expect(result.pass).toBe(true);
    });

    it("fails with non-4px aligned value", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": createText(
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
            "Hello"
          ),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      scene.objects["018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b"].style = { margin: 15 };
      const result = lintSceneWithRules(scene, ["L-GRID"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-GRID")).toBe(true);
    });
  });

  describe("L-CONTRAST: WCAG AA Contrast Ratio", () => {
    it("passes with token color and background meeting WCAG AA", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": createText(
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
            "Hello",
            { $type: "token", $value: "token.color.text.primary" }
          ),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      scene.objects["018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b"].style = { 
        background: { $type: "token", $value: "token.color.background" } 
      };
      const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
      expect(result.pass).toBe(true);
    });

    it("fails #777777 on #ffffff (ratio 4.48:1 < 4.5)", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": {
            ...createText("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b", "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a", "Hello"),
            props: { content: "Hello", fontSize: 16, color: "#777777" },
            style: { background: "#ffffff" },
            meta: {},
          },
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
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
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": {
            ...createText("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b", "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a", "Hello"),
            props: { content: "Hello", fontSize: 16, color: "#767676" },
            style: { background: "#ffffff" },
            meta: {},
          },
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
      expect(result.pass).toBe(true);
    });

    it("passes large text (18px+) with 3:1 ratio", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": {
            ...createText("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b", "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a", "Hello"),
            props: { content: "Hello", fontSize: 18, color: "#888888" },
            style: { background: "#ffffff" },
            meta: {},
          },
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
      expect(result.pass).toBe(true);
    });

    it("fails non-token color or background", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": createText(
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
            "Hello",
            "#ff0000"
          ),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      scene.objects["018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b"].style = { background: "#ffffff" };
      const result = lintSceneWithRules(scene, ["L-CONTRAST"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-CONTRAST")).toBe(true);
    });
  });

  describe("L-TOUCH: Touch Target 44px", () => {
    it("fails button with width < 44px", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": createButton(
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
            "Click",
            { minWidth: 32, minHeight: 44 }
          ),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-TOUCH"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-TOUCH")).toBe(true);
    });

    it("fails button with height < 44px", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": createButton(
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
            "Click",
            { minWidth: 44, minHeight: 32 }
          ),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-TOUCH"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-TOUCH")).toBe(true);
    });

    it("passes button with 44px touch target", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": createButton(
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
            "Click"
          ),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
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
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": createText(
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
            "Hello"
          ),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-LOCK"], []);
      expect(result.pass).toBe(true);
    });

    it("fails when object is locked", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": createText(
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
            "Hello"
          ),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      const result = lintSceneWithRules(scene, ["L-LOCK"], ["018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b"]);
      expect(result.pass).toBe(false);
      expect(result.violations.some(v => v.ruleId === "L-LOCK")).toBe(true);
    });
  });

  describe("Full lint pass", () => {
    it("passes clean scene", () => {
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const containerId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const textId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      const buttonId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d";

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

      const result = lintScene(scene, []);
      expect(result.pass).toBe(true);
    });

    it("collects all violations", () => {
      const scene = createBaseScene({
        objects: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b": createText(
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
            "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
            "Hello",
            "#ff0000"
          ),
        },
        screens: {
          "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a": createScreen("018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a"),
        },
      });
      scene.objects["018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b"].style = { background: "#ffffff" };
      const result = lintScene(scene, []);
      expect(result.pass).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
});