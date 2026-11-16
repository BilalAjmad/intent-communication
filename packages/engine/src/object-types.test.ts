import { describe, it, expect } from "vitest";
import { exportToHtml } from "./index";
import type { Scene } from "@intent/schema";
import { createBaseScene, createScreen, createContainer } from "../tests/test-helpers";

// Extracted from index.test.ts (M2.A: new object types).
describe("new object types (M2.A)", () => {
    const screenId = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const containerId = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

    function sceneWith(
      objects: Record<string, unknown>,
      childIds: string[],
    ): Scene {
      return createBaseScene({
        screens: { [screenId]: createScreen(screenId, "Home", [containerId]) },
        objects: {
          [screenId]: createScreen(screenId, "Home", [containerId]),
          [containerId]: createContainer(containerId, screenId, childIds),
          ...(objects as Record<string, Scene["objects"][string]>),
        },
        screenOrder: [screenId],
      }) as Scene;
    }

    it("renders checkbox with label and checked state", () => {
      const checkboxId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
      const scene = sceneWith(
        {
          [checkboxId]: {
            id: checkboxId, type: "checkbox", parentId: containerId, children: [],
            props: { label: "I agree", checked: true, disabled: false, name: "agree" },
            style: {}, meta: {},
          },
        },
        [checkboxId],
      );
      const html = exportToHtml(scene);
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('name="agree"');
      expect(html).toContain("checked");
      expect(html).toContain("I agree");
      expect(html).toContain("intent-checkbox");
    });

    it("renders radio with name and value", () => {
      const radioId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
      const scene = sceneWith(
        {
          [radioId]: {
            id: radioId, type: "radio", parentId: containerId, children: [],
            props: { label: "Pro plan", name: "plan", value: "pro", checked: false },
            style: {}, meta: {},
          },
        },
        [radioId],
      );
      const html = exportToHtml(scene);
      expect(html).toContain('type="radio"');
      expect(html).toContain('name="plan"');
      expect(html).toContain('value="pro"');
      expect(html).toContain("intent-radio");
    });

    it("renders switch with role=switch", () => {
      const switchId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
      const scene = sceneWith(
        {
          [switchId]: {
            id: switchId, type: "switch", parentId: containerId, children: [],
            props: { label: "Notifications", checked: true },
            style: {}, meta: {},
          },
        },
        [switchId],
      );
      const html = exportToHtml(scene);
      expect(html).toContain('role="switch"');
      expect(html).toContain("switch-track");
      expect(html).toContain("Notifications");
    });

    it("keeps fragment links, drops external URLs (trd rule 8)", () => {
      const fragId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
      const extId = "o_04ARZ3NDEKTSV4RRFFQ69G5FAV";
      const scene = sceneWith(
        {
          [fragId]: {
            id: fragId, type: "link", parentId: containerId, children: [],
            props: { label: "Home", href: "#s-home" },
            style: {}, meta: {},
          },
          [extId]: {
            id: extId, type: "link", parentId: containerId, children: [],
            props: { label: "Docs", href: "https://example.com" },
            style: {}, meta: {},
          },
        },
        [fragId, extId],
      );
      const html = exportToHtml(scene);
      expect(html).toContain('href="#s-home"');
      // trd rule 8: the <a> tag itself must not carry the external URL.
      // (The scene JSON payload legitimately embeds the raw value as data.)
      const docLink = /<a\b[^>]*>Docs<\/a>/.exec(html)?.[0] ?? "";
      expect(docLink).not.toContain("https://example.com");
      expect(docLink).toContain("Docs"); // label still renders
    });

    it("adds rel=noopener to target=_blank links", () => {
      const linkId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
      const scene = sceneWith(
        {
          [linkId]: {
            id: linkId, type: "link", parentId: containerId, children: [],
            props: { label: "External", href: "#s-x", target: "_blank" },
            style: {}, meta: {},
          },
        },
        [linkId],
      );
      const html = exportToHtml(scene);
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener"');
    });

    it("escapes list items (no HTML injection)", () => {
      const listId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
      const scene = sceneWith(
        {
          [listId]: {
            id: listId, type: "list", parentId: containerId, children: [],
            props: { ordered: true, items: ["<img onerror=alert(1)>", "second"] },
            style: {}, meta: {},
          },
        },
        [listId],
      );
      const html = exportToHtml(scene);
      expect(html).toContain("<ol");
      expect(html).not.toContain("<img onerror");
      expect(html).toContain("&lt;img onerror=alert(1)&gt;");
      expect(html).toContain("second");
    });

    it("renders modal as <dialog> with title, children and open attribute", () => {
      const modalId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
      const textId = "o_04ARZ3NDEKTSV4RRFFQ69G5FAV";
      const scene = sceneWith(
        {
          [modalId]: {
            id: modalId, type: "modal", parentId: containerId, children: [textId],
            props: { title: "Confirm", size: "lg", open: true },
            style: {}, meta: {},
          },
          [textId]: {
            id: textId, type: "text", parentId: modalId, children: [],
            props: { content: "Delete everything?" },
            style: {}, meta: {},
          },
        },
        [modalId],
      );
      const html = exportToHtml(scene);
      expect(html).toContain('<dialog class="intent-modal intent-modal-lg" open');
      expect(html).toContain("Confirm");
      expect(html).toContain("Delete everything?");
      expect(html).toContain("intent-modal-title");
    });

    it("renders allowlisted icon as inline SVG with aria-label", () => {
      const iconId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
      const scene = sceneWith(
        {
          [iconId]: {
            id: iconId, type: "icon", parentId: containerId, children: [],
            props: { icon: "check", size: 32, label: "Done" },
            style: {}, meta: {},
          },
        },
        [iconId],
      );
      const html = exportToHtml(scene);
      expect(html).toContain("<svg");
      expect(html).toContain('width="32"');
      expect(html).toContain('aria-label="Done"');
      expect(html).toContain("intent-icon");
    });

    it("renders unknown icon with fallback glyph, never throws", () => {
      const iconId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
      const scene = sceneWith(
        {
          [iconId]: {
            id: iconId, type: "icon", parentId: containerId, children: [],
            props: { icon: "definitely-not-an-icon", size: 24 },
            style: {}, meta: {},
          },
        },
        [iconId],
      );
      const html = exportToHtml(scene);
      expect(html).toContain("<svg");
      expect(html).toContain('aria-hidden="true"');
    });

    it("renders divider as <hr> with thickness from props", () => {
      const dividerId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
      const scene = sceneWith(
        {
          [dividerId]: {
            id: dividerId, type: "divider", parentId: containerId, children: [],
            props: { direction: "horizontal", thickness: 3 },
            style: {}, meta: {},
          },
        },
        [dividerId],
      );
      const html = exportToHtml(scene);
      expect(html).toContain('<hr class="intent-divider intent-divider-horizontal"');
      expect(html).toContain("height: 3px;");
    });

    it("escapes label with quotes in checkbox (attribute injection)", () => {
      const checkboxId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
      const scene = sceneWith(
        {
          [checkboxId]: {
            id: checkboxId, type: "checkbox", parentId: containerId, children: [],
            props: { label: 'x"><script>alert(1)</script>' },
            style: {}, meta: {},
          },
        },
        [checkboxId],
      );
      const html = exportToHtml(scene);
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&quot;&gt;&lt;script&gt;");
    });
});
