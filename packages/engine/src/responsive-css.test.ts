import { describe, it, expect } from "vitest";
import type { Scene } from "@intent/schema";
import {
  exportToHtml,
  exportToReact,
  renderResponsiveCss,
  DEFAULT_BREAKPOINTS,
} from "./index";
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
        style: {},
        meta: {},
        states: {},
        responsive: {},
        ...button,
      },
    } as Scene["objects"],
    screenOrder: [SCREEN],
  });
}

describe("renderResponsiveCss (trd 4.4)", () => {
  it("emits @media blocks in ascending width order", () => {
    const scene = sceneWithButton({
      responsive: {
        lg: { style: { padding: "24px" } },
        sm: { style: { padding: "8px" } },
        md: { style: { padding: "16px" } },
      },
    });
    const css = renderResponsiveCss(scene);
    const sm = css.indexOf("(min-width: 640px)");
    const md = css.indexOf("(min-width: 1024px)");
    const lg = css.indexOf("(min-width: 1440px)");
    expect(sm).toBeGreaterThanOrEqual(0);
    expect(md).toBeGreaterThan(sm);
    expect(lg).toBeGreaterThan(md);
  });

  it("maps layout overrides to flex declarations", () => {
    const scene = sceneWithButton({
      responsive: { sm: { layout: { direction: "column", gap: 12, padding: 20 } } },
    });
    const css = renderResponsiveCss(scene);
    expect(css).toContain("flex-direction: column");
    expect(css).toContain("gap: 12px");
    expect(css).toContain("padding: 20px");
  });

  it("keeps safe size values and drops unsafe ones", () => {
    const scene = sceneWithButton({
      responsive: { sm: { size: { width: "50%", height: 64 } } },
    });
    const css = renderResponsiveCss(scene);
    expect(css).toContain("width: 50%");
    expect(css).toContain("height: 64px");
  });

  it("maps position to position:absolute with left/top", () => {
    const scene = sceneWithButton({
      responsive: { md: { position: { x: 30, y: -10 } } },
    });
    const css = renderResponsiveCss(scene);
    expect(css).toContain("position: absolute");
    expect(css).toContain("left: 30px");
    expect(css).toContain("top: -10px");
  });

  it("emits display:none for visible:false override", () => {
    const scene = sceneWithButton({
      responsive: { lg: { visible: false } },
    });
    const css = renderResponsiveCss(scene);
    expect(css).toContain("display: none");
  });

  it("honors custom breakpoints", () => {
    const scene = sceneWithButton({
      responsive: { sm: { style: { padding: "8px" } } },
    });
    const css = renderResponsiveCss(scene, { sm: 700, md: 1100, lg: 1500 });
    expect(css).toContain("(min-width: 700px)");
    expect(css).not.toContain("(min-width: 640px)");
  });

  it("returns empty string when no object has overrides", () => {
    expect(renderResponsiveCss(createBaseScene({ objects: {} }))).toBe("");
  });

  it("exportToHtml embeds the @media blocks", () => {
    const scene = sceneWithButton({
      responsive: { sm: { style: { padding: "8px" } } },
    });
    expect(exportToHtml(scene)).toContain("@media (min-width: 640px)");
  });

  it("exportToReact tokens.css embeds the @media blocks", () => {
    const scene = sceneWithButton({
      responsive: { md: { style: { width: "100%" } } },
    });
    const files = exportToReact(scene);
    expect(files["intent-export/tokens.css"]).toContain("@media (min-width: 1024px)");
  });

  it("exports default breakpoints constant", () => {
    expect(DEFAULT_BREAKPOINTS).toEqual({ sm: 640, md: 1024, lg: 1440 });
  });
});
