import { describe, it, expect } from "vitest";
import {
  normalizeScene,
  exportToHtml,
  SCHEMA_VERSION,
  SCENE_SCHEMA_VERSION,
} from "./index";
import { Scene, Screen, Container, Text, Button, Image } from "@intent/schema";

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

function createScreen(id: string, title: string = "Test Screen", children: string[] = []): Screen {
  return {
    id,
    type: "screen",
    parentId: null,
    children,
    props: { title, width: 1280, height: 720 },
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

function createText(id: string, parentId: string, content: string): Text {
  return {
    id,
    type: "text",
    parentId,
    children: [],
    props: { content, fontSize: 16 },
    style: {},
    meta: {},
  };
}

function createButton(id: string, parentId: string, label: string): Button {
  return {
    id,
    type: "button",
    parentId,
    children: [],
    props: { label, variant: "primary" },
    style: { minWidth: 44, minHeight: 44 },
    meta: {},
  };
}

function createImage(id: string, parentId: string, src: string): Image {
  return {
    id,
    type: "image",
    parentId,
    children: [],
    props: { src, alt: "Test image", fit: "cover" },
    style: {},
    meta: {},
  };
}

describe("Engine package", () => {
  describe("normalizeScene", () => {
    it("applies default screen props", () => {
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const scene = createBaseScene({
        screens: { [screenId]: { ...createScreen(screenId), props: {} } },
        objects: { [screenId]: { ...createScreen(screenId), props: {} } },
      });
      const result = normalizeScene(scene, { applyDefaults: true });
      expect(result.scene.objects[screenId].props.title).toBe("Untitled");
      expect(result.scene.objects[screenId].props.width).toBe(1280);
      expect(result.scene.objects[screenId].props.height).toBe(720);
    });

    it("applies default container props", () => {
      const containerId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId, "", [containerId]) },
        objects: {
          [screenId]: createScreen(screenId, "", [containerId]),
          [containerId]: { ...createContainer(containerId, screenId), props: {} },
        },
      });
      const result = normalizeScene(scene, { applyDefaults: true });
      expect(result.scene.objects[containerId].props.layout).toBe("flex");
      expect(result.scene.objects[containerId].props.gap).toBe(0);
      expect(result.scene.objects[containerId].props.padding).toBe(0);
    });

    it("applies default text props", () => {
      const textId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      const containerId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId, "", [containerId]) },
        objects: {
          [screenId]: createScreen(screenId, "", [containerId]),
          [containerId]: createContainer(containerId, screenId, [textId]),
          [textId]: { ...createText(textId, containerId, "Hello"), props: { content: "Hello" } },
        },
      });
      const result = normalizeScene(scene, { applyDefaults: true });
      expect(result.scene.objects[textId].props.fontSize).toBe(16);
      expect(result.scene.objects[textId].props.fontWeight).toBe("normal");
      expect(result.scene.objects[textId].props.lineHeight).toBe(1.5);
      expect(result.scene.objects[textId].props.textAlign).toBe("left");
    });

    it("applies default button props", () => {
      const buttonId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d";
      const containerId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId, "", [containerId]) },
        objects: {
          [screenId]: createScreen(screenId, "", [containerId]),
          [containerId]: createContainer(containerId, screenId, [buttonId]),
          [buttonId]: { ...createButton(buttonId, containerId, "Click"), props: { label: "Click" }, style: {} },
        },
      });
      const result = normalizeScene(scene, { applyDefaults: true });
      expect(result.scene.objects[buttonId].props.variant).toBe("primary");
      expect(result.scene.objects[buttonId].props.size).toBe("md");
      expect(result.scene.objects[buttonId].props.disabled).toBe(false);
      expect(result.scene.objects[buttonId].style.minWidth).toBe(44);
      expect(result.scene.objects[buttonId].style.minHeight).toBe(44);
    });

    it("strips unknown tokens", () => {
      const textId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      const containerId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId, "", [containerId]) },
        objects: {
          [screenId]: createScreen(screenId, "", [containerId]),
          [containerId]: createContainer(containerId, screenId, [textId]),
          [textId]: {
            ...createText(textId, containerId, "Hello"),
            props: { content: "Hello", color: { $type: "token", $value: "token.unknown.value" } },
          },
        },
      });
      const result = normalizeScene(scene, { stripUnknownTokens: true });
      expect(result.changes.some(c => c.includes("strip unknown token"))).toBe(true);
    });

    it("ensures required image alt", () => {
      const imageId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5e";
      const containerId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId, "", [containerId]) },
        objects: {
          [screenId]: createScreen(screenId, "", [containerId]),
          [containerId]: createContainer(containerId, screenId, [imageId]),
          [imageId]: { ...createImage(imageId, containerId, "test.png"), props: { src: "test.png", alt: "" } },
        },
      });
      const result = normalizeScene(scene, { ensureRequiredProps: true });
      expect(result.scene.objects[imageId].props.alt).toBe("");
    });
  });

  describe("exportToHtml", () => {
    it("generates valid HTML for simple scene", () => {
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const containerId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const textId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      const buttonId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d";

      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId, "Home", [containerId]) },
        objects: {
          [screenId]: createScreen(screenId, "Home", [containerId]),
          [containerId]: createContainer(containerId, screenId, [textId, buttonId]),
          [textId]: createText(textId, containerId, "Welcome"),
          [buttonId]: createButton(buttonId, containerId, "Get Started"),
        },
        screenOrder: [screenId],
      });

      const html = exportToHtml(scene);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<title>Test</title>");
      expect(html).toContain("Welcome");
      expect(html).toContain("Get Started");
      expect(html).toContain("intent-screen");
      expect(html).toContain("intent-container");
      expect(html).toContain("intent-text");
      expect(html).toContain("intent-button");
      expect(html).toContain("var(--intent-color-primary)");
    });

    it("includes CSS variables when includeStyles=true", () => {
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId) },
        objects: { [screenId]: createScreen(screenId) },
      });
      const html = exportToHtml(scene, { includeStyles: true });
      expect(html).toContain("--intent-color-primary");
      expect(html).toContain("--intent-spacing-md");
      expect(html).toContain("--intent-typography-fontSize-md");
    });

    it("excludes styles when includeStyles=false", () => {
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId) },
        objects: { [screenId]: createScreen(screenId) },
      });
      const html = exportToHtml(scene, { includeStyles: false });
      expect(html).not.toContain("--intent-color-primary");
    });

    it("includes script with scene data when includeScripts=true", () => {
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId) },
        objects: { [screenId]: createScreen(screenId) },
        metadata: { name: "Test Project" },
      });
      const html = exportToHtml(scene, { includeScripts: true });
      expect(html).toContain("__INTENT_SCENE__");
      expect(html).toContain("Test Project");
      expect(html).toContain("INTENT_CLICK");
    });

    it("escapes HTML in text content", () => {
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const textId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      const containerId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId, "", [containerId]) },
        objects: {
          [screenId]: createScreen(screenId, "", [containerId]),
          [containerId]: createContainer(containerId, screenId, [textId]),
          [textId]: createText(textId, containerId, "<script>alert('xss')</script>"),
        },
      });
      const html = exportToHtml(scene);
      // The script tag should be escaped in the body content
      expect(html).toContain("<script>alert(&#039;xss&#039;)</script>");
      // The head script for scene data is expected
      expect(html).toContain("window.__INTENT_SCENE__");
    });

    it("renders multiple screens in screenOrder", () => {
      const screen1Id = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const screen2Id = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const screen3Id = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";

      const scene = createBaseScene({
        screens: {
          [screen1Id]: createScreen(screen1Id, "Screen 1"),
          [screen2Id]: createScreen(screen2Id, "Screen 2"),
          [screen3Id]: createScreen(screen3Id, "Screen 3"),
        },
        objects: {
          [screen1Id]: createScreen(screen1Id, "Screen 1"),
          [screen2Id]: createScreen(screen2Id, "Screen 2"),
          [screen3Id]: createScreen(screen3Id, "Screen 3"),
        },
        screenOrder: [screen3Id, screen1Id, screen2Id],
      });

      const html = exportToHtml(scene);
      const screen1Pos = html.indexOf(`data-screen-id="${screen1Id}"`);
      const screen2Pos = html.indexOf(`data-screen-id="${screen2Id}"`);
      const screen3Pos = html.indexOf(`data-screen-id="${screen3Id}"`);
      expect(screen3Pos).toBeLessThan(screen1Pos);
      expect(screen1Pos).toBeLessThan(screen2Pos);
    });

    it("includes CSP nonce when provided", () => {
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId) },
        objects: { [screenId]: createScreen(screenId) },
      });
      const html = exportToHtml(scene, { cspNonce: "abc123" });
      expect(html).toContain('nonce="abc123"');
    });

    it("renders image with fit class", () => {
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const containerId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const imageId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";

      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId, "", [containerId]) },
        objects: {
          [screenId]: createScreen(screenId, "", [containerId]),
          [containerId]: createContainer(containerId, screenId, [imageId]),
          [imageId]: createImage(imageId, containerId, "https://example.com/img.png"),
        },
      });

      const html = exportToHtml(scene);
      expect(html).toContain("intent-image");
      expect(html).toContain("intent-fit-cover");
      expect(html).toContain("https://example.com/img.png");
    });

    it("renders input with correct attributes", () => {
      const screenId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const containerId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const inputId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";

      const scene = createBaseScene({
        screens: { [screenId]: createScreen(screenId, "", [containerId]) },
        objects: {
          [screenId]: createScreen(screenId, "", [containerId]),
          [containerId]: createContainer(containerId, screenId, [inputId]),
          [inputId]: {
            id: inputId,
            type: "input",
            parentId: containerId,
            children: [],
            props: { type: "email", placeholder: "Email", value: "test@example.com", required: true },
            style: {},
            meta: {},
          },
        },
      });

      const html = exportToHtml(scene);
      expect(html).toContain('type="email"');
      expect(html).toContain('placeholder="Email"');
      expect(html).toContain('value="test@example.com"');
      expect(html).toContain("required");
    });
  });

  describe("version exports", () => {
    it("exports SCHEMA_VERSION", () => {
      expect(SCHEMA_VERSION).toBe(1);
    });

    it("exports SCENE_SCHEMA_VERSION", () => {
      expect(SCENE_SCHEMA_VERSION).toBe(1);
    });
  });
});