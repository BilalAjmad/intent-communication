import { describe, it, expect } from "vitest";
import type { Scene } from "@intent/schema";
import { exportToHtml, exportToReact, renderStateCss } from "./index";
import { createBaseScene, createScreen, createContainer } from "../tests/test-helpers";

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const CONT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BTN = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";

function sceneWithButton(button: Record<string, unknown>): Scene {
  return createBaseScene({
    screens: { [SCREEN]: createScreen(SCREEN, "Home", [CONT]) },
    objects: {
      [SCREEN]: createScreen(SCREEN, "Home", [CONT]),
      [CONT]: createContainer(CONT, SCREEN, [BTN]),
      [BTN]: {
        id: BTN, type: "button", parentId: CONT, children: [],
        props: { label: "Go", variant: "primary" },
        style: { background: "#111111" },
        meta: {},
        states: {},
        ...button,
      },
    } as Scene["objects"],
    screenOrder: [SCREEN],
  });
}

describe("renderStateCss (trd 5.3)", () => {
  it("emits pseudo-state rules scoped by data-object-id", () => {
    const scene = sceneWithButton({
      states: { hover: { style: { background: "#ff0000" } } },
    });
    const css = renderStateCss(scene);
    expect(css).toContain(`[data-object-id="${BTN}"]:hover { background: #ff0000 }`);
  });

  it("emits data-state rules for data states", () => {
    const scene = sceneWithButton({
      states: { error: { style: { borderColor: "#ff0000" } } },
    });
    const css = renderStateCss(scene);
    expect(css).toContain(`[data-object-id="${BTN}"][data-state~="error"] { border-color: #ff0000 }`);
  });

  it("emits display:none for visible:false overrides", () => {
    const scene = sceneWithButton({
      states: { empty: { visible: false } },
    });
    const css = renderStateCss(scene);
    expect(css).toContain(`[data-object-id="${BTN}"][data-state~="empty"] { display: none !important; }`);
  });

  it("drops unsafe declarations instead of emitting them", () => {
    const scene = sceneWithButton({
      states: {
        hover: { style: { background: "url(https://evil.example/x)", color: "#00ff00" } },
      },
    });
    const css = renderStateCss(scene);
    expect(css).not.toContain("url(");
    // the safe sibling declaration in the same override is kept
    expect(css).toContain(`[data-object-id="${BTN}"]:hover { color: #00ff00 }`);
  });

  it("returns empty string when no object has states", () => {
    const scene = createBaseScene({ objects: {} });
    expect(renderStateCss(scene)).toBe("");
  });

  it("exportToHtml embeds the state rules", () => {
    const scene = sceneWithButton({
      states: { hover: { style: { background: "#ff0000" } } },
    });
    const html = exportToHtml(scene);
    expect(html).toContain(`[data-object-id="${BTN}"]:hover`);
  });

  it("exportToReact tokens.css embeds the state rules", () => {
    const scene = sceneWithButton({
      states: { hover: { style: { background: "#ff0000" } } },
    });
    const files = exportToReact(scene);
    expect(files["intent-export/tokens.css"]).toContain(`[data-object-id="${BTN}"]:hover`);
  });

  it("normalizeScene preserves states through the pipeline", async () => {
    const { normalizeScene } = await import("./index");
    const scene = sceneWithButton({
      states: { hover: { style: { background: "#ff0000" } } },
    });
    const result = normalizeScene(scene, { applyDefaults: true });
    expect(result.scene.objects[BTN].states?.hover?.style?.background).toBe("#ff0000");
  });
});
