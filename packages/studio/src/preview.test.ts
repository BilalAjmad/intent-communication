import { describe, it, expect } from "vitest";
import { buildPreviewDocument } from "./preview";
import { Scene } from "@intent/schema";

// Unit tests for the separate preview renderer (S-1-11/12/13).
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BTN = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TXT = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const IMG = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";

function baseScene(objects: Record<string, unknown>, children: string[]): Scene {
  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN,
        type: "screen",
        parentId: null,
        children,
        props: { title: "Preview", width: 1280, height: 720 },
        style: {},
        meta: {},
      },
    },
    objects: objects as Scene["objects"],
    screenOrder: [SCREEN],
    metadata: { name: "Preview Test", tags: [] },
  };
}

describe("buildPreviewDocument (S-1-11)", () => {
  it("renders a screen, text and button in one document", () => {
    const html = buildPreviewDocument(
      baseScene(
        {
          [TXT]: { id: TXT, type: "text", parentId: SCREEN, children: [], props: { content: "Hello <world>" }, style: {}, meta: {} },
          [BTN]: { id: BTN, type: "button", parentId: SCREEN, children: [], props: { label: "Save", variant: "primary" }, style: {}, meta: {} },
        },
        [TXT, BTN]
      )
    );
    expect(html).toContain("preview-root");
    expect(html).toContain("Hello &lt;world&gt;");
    expect(html).toContain('class="intent-button intent-button-primary"');
    expect(html).toContain('data-object-id="o_01ARZ3NDEKTSV4RRFFQ69G5FAV"');
  });

  it("escapes HTML attribute values from props", () => {
    // Type the button via the schema union fallback: it accepts the raw payload
    const html = buildPreviewDocument(
      baseScene(
        {
          [BTN]: { id: BTN, type: "button", parentId: SCREEN, children: [], props: { label: '" onclick="window.__XSS__=1', variant: "primary" }, style: {}, meta: {} },
        },
        [BTN]
      )
    );
    expect(html).not.toContain('onclick="window.__XSS__=1"');
    expect(html).toContain("intent-button-primary");
  });

  it("emits a CSP meta tag that blocks all sources except inline style + data: images", () => {
    const html = buildPreviewDocument(baseScene({}, [TXT]));
    expect(html).toContain("default-src &#039;none&#039;");
    expect(html).toContain("img-src data:");
  });

  it("emits alt text on image nodes", () => {
    const html = buildPreviewDocument(
      baseScene(
        {
          [IMG]: {
            id: IMG,
            type: "image",
            parentId: SCREEN,
            children: [],
            props: { src: "data:image/png;base64,iVBORw0KGgo=", alt: "alt text", fit: "cover" },
            style: {},
            meta: {},
          },
        },
        [IMG]
      )
    );
    expect(html).toContain('alt="alt text"');
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
  });
});
