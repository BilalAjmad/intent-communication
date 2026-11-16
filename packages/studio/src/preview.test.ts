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

describe("states (trd 5.3) in preview", () => {
  const BTN = "o_12ARZ3NDEKTSV4RRFFQ69G5FAV";

  it("embeds state CSS and the forceState runtime handler", () => {
    const html = buildPreviewDocument(
      baseScene(
        {
          [BTN]: {
            id: BTN, type: "button", parentId: SCREEN, children: [],
            props: { label: "Go", variant: "primary" },
            style: {}, meta: {},
            states: { hover: { style: { background: "#ff0000" } } },
          },
        },
        [BTN]
      )
    );
    expect(html).toContain(`[data-object-id="${BTN}"]:hover { background: #ff0000 }`);
    expect(html).toContain('msg.t === "forceState"');
    expect(html).toContain("data-state");
  });

  it("embeds responsive @media blocks (trd 4.4)", () => {
    const html = buildPreviewDocument(
      baseScene(
        {
          [BTN]: {
            id: BTN, type: "button", parentId: SCREEN, children: [],
            props: { label: "Go", variant: "primary" },
            style: {}, meta: {},
            states: {},
            responsive: { sm: { style: { padding: "8px" } } },
          },
        },
        [BTN]
      )
    );
    expect(html).toContain("@media (min-width: 640px)");
    expect(html).toContain("padding: 8px");
  });
});

describe("new object types (M2.A) in preview", () => {
  const CB = "o_04ARZ3NDEKTSV4RRFFQ69G5FAV";
  const SW = "o_05ARZ3NDEKTSV4RRFFQ69G5FAV";
  const LINK = "o_06ARZ3NDEKTSV4RRFFQ69G5FAV";
  const LIST = "o_07ARZ3NDEKTSV4RRFFQ69G5FAV";
  const MODAL = "o_08ARZ3NDEKTSV4RRFFQ69G5FAV";
  const INNER = "o_09ARZ3NDEKTSV4RRFFQ69G5FAV";
  const ICON = "o_10ARZ3NDEKTSV4RRFFQ69G5FAV";
  const HR = "o_11ARZ3NDEKTSV4RRFFQ69G5FAV";

  it("renders checkbox, switch and link with data-object-id hooks", () => {
    const html = buildPreviewDocument(
      baseScene(
        {
          [CB]: { id: CB, type: "checkbox", parentId: SCREEN, children: [], props: { label: "Agree", checked: true }, style: {}, meta: {} },
          [SW]: { id: SW, type: "switch", parentId: SCREEN, children: [], props: { label: "Notify" }, style: {}, meta: {} },
          [LINK]: { id: LINK, type: "link", parentId: SCREEN, children: [], props: { label: "Home", href: "#s-home" }, style: {}, meta: {} },
        },
        [CB, SW, LINK]
      )
    );
    expect(html).toContain(`data-object-id="${CB}"`);
    expect(html).toContain(`data-object-id="${SW}"`);
    expect(html).toContain(`data-object-id="${LINK}"`);
    expect(html).toContain('role="switch"');
    expect(html).toContain('href="#s-home"');
  });

  it("escapes list items and renders ordered list", () => {
    const html = buildPreviewDocument(
      baseScene(
        {
          [LIST]: { id: LIST, type: "list", parentId: SCREEN, children: [], props: { ordered: true, items: ["<b>x</b>", "y"] }, style: {}, meta: {} },
        },
        [LIST]
      )
    );
    expect(html).toContain("<ol");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });

  it("renders modal as <dialog> with children inside", () => {
    const html = buildPreviewDocument(
      baseScene(
        {
          [MODAL]: { id: MODAL, type: "modal", parentId: SCREEN, children: [INNER], props: { title: "Confirm", size: "sm", open: true }, style: {}, meta: {} },
          [INNER]: { id: INNER, type: "text", parentId: MODAL, children: [], props: { content: "Proceed?" }, style: {}, meta: {} },
        },
        [MODAL]
      )
    );
    expect(html).toContain('<dialog class="intent-modal intent-modal-sm" open');
    expect(html).toContain("Confirm");
    expect(html).toContain("Proceed?");
    expect(html).toContain("intent-modal-title");
  });

  it("renders allowlisted icon as inline SVG; unknown name falls back safely", () => {
    const known = buildPreviewDocument(
      baseScene(
        {
          [ICON]: { id: ICON, type: "icon", parentId: SCREEN, children: [], props: { icon: "warning", size: 20, label: "Careful" }, style: {}, meta: {} },
        },
        [ICON]
      )
    );
    expect(known).toContain("<svg");
    expect(known).toContain('aria-label="Careful"');
    const unknown = buildPreviewDocument(
      baseScene(
        {
          [ICON]: { id: ICON, type: "icon", parentId: SCREEN, children: [], props: { icon: "bogus-icon" }, style: {}, meta: {} },
        },
        [ICON]
      )
    );
    expect(unknown).toContain("<svg");
    expect(unknown).toContain('aria-hidden="true"');
  });

  it("renders divider as <hr> with thickness style", () => {
    const html = buildPreviewDocument(
      baseScene(
        {
          [HR]: { id: HR, type: "divider", parentId: SCREEN, children: [], props: { direction: "vertical", thickness: 2 }, style: {}, meta: {} },
        },
        [HR]
      )
    );
    expect(html).toContain("intent-divider-vertical");
    expect(html).toContain("width: 2px;");
  });
});
