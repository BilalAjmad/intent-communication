import { describe, it, expect } from "vitest";
import type { Scene } from "@intent/schema";
import { exportToHtml, normalizeSceneToModel } from "./index";
import { renderAnimationCss } from "./animation-css";
import { createBaseScene, createScreen, createContainer } from "../tests/test-helpers";

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const CONT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";

function sceneWithTransition(): Scene {
  return createBaseScene({
    screens: {
      [SCREEN]: createScreen(SCREEN, "Home", [CONT]),
    },
    objects: {
      [SCREEN]: createScreen(SCREEN, "Home", [CONT]),
      [CONT]: createContainer(CONT, SCREEN, [TEXT]),
      [TEXT]: {
        id: TEXT, type: "text", parentId: CONT, children: [],
        props: { content: "Animated" },
        style: { transition: "background-color 0.2s ease", color: "token.color.text.primary" },
        meta: {},
      },
    },
    screenOrder: [SCREEN],
  } as never);
}

describe("trd 13.6 animations & transitions", () => {
  it("exports transition declarations inside @media (prefers-reduced-motion: no-preference)", () => {
    const html = exportToHtml(sceneWithTransition());
    expect(html).toContain("@media (prefers-reduced-motion: no-preference)");
    expect(html).toContain('[data-object-id="o_02ARZ3NDEKTSV4RRFFQ69G5FAV"] { transition: background-color 0.2s ease; }');
    // Not left inline on the element.
    expect(html).toContain('style="color: var(--intent-color-text-primary);"');
    expect(html).not.toContain('style="transition: background-color 0.2s ease;');
  });

  it("still neutralizes motion under prefers-reduced-motion: reduce (base guard)", () => {
    const html = exportToHtml(sceneWithTransition());
    expect(html).toContain("prefers-reduced-motion: reduce");
  });

  it("keeps animation declarations inline when includeDataIds is false", () => {
    const html = exportToHtml(sceneWithTransition(), { includeDataIds: false });
    expect(html).toContain('style="color: var(--intent-color-text-primary); transition: background-color 0.2s ease;"');
    expect(html).not.toContain("no-preference");
  });

  it("renderAnimationCss returns an empty string without anim nodes", () => {
    const model = normalizeSceneToModel(createBaseScene({
      screens: { [SCREEN]: createScreen(SCREEN, "Home", [CONT]) },
      objects: {
        [SCREEN]: createScreen(SCREEN, "Home", [CONT]),
        [CONT]: createContainer(CONT, SCREEN, []),
      },
      screenOrder: [SCREEN],
    } as never));
    expect(renderAnimationCss(model, { includeDataIds: true })).toBe("");
  });

  it("emits scene keyframes inside the no-preference media block (trd 13.6)", () => {
    const scene = createBaseScene({
      screens: { [SCREEN]: createScreen(SCREEN, "Home", [CONT]) },
      objects: {
        [SCREEN]: createScreen(SCREEN, "Home", [CONT]),
        [CONT]: createContainer(CONT, SCREEN, [TEXT]),
        [TEXT]: {
          id: TEXT, type: "text", parentId: CONT, children: [],
          props: { content: "Animated" },
          style: { animation: "fade-up 0.6s ease infinite" },
          meta: {},
        },
      },
      screenOrder: [SCREEN],
      metadata: {
        name: "Test", tags: [],
        keyframes: {
          "fade-up": {
            to: { opacity: "1", transform: "translateY(0)" },
            from: { opacity: "0", transform: "translateY(8px)" },
          },
        },
      },
    } as never);
    const model = normalizeSceneToModel(scene);
    const css = renderAnimationCss(model, { includeDataIds: true });
    expect(css).toContain("@media (prefers-reduced-motion: no-preference) {");
    expect(css).toContain("@keyframes fade-up {");
    expect(css.indexOf("from {")).toBeLessThan(css.indexOf("to {"));
    expect(css).toContain("opacity: 0;");
    expect(css).toContain('[data-object-id="o_02ARZ3NDEKTSV4RRFFQ69G5FAV"] { animation: fade-up 0.6s ease infinite; }');
  });

  it("drops unsafe keyframe values at render time (defense in depth)", () => {
    const scene = createBaseScene({
      screens: { [SCREEN]: createScreen(SCREEN, "Home", [CONT]) },
      objects: {
        [SCREEN]: createScreen(SCREEN, "Home", [CONT]),
        [CONT]: createContainer(CONT, SCREEN, []),
      },
      screenOrder: [SCREEN],
      metadata: {
        name: "Test", tags: [],
        keyframes: {
          // The schema grammars bound names/offsets/properties but not the inner
          // value payload — the engine must sanitize it ("; }" smuggled rule).
          fade: { from: { opacity: "0; } body { display: none" }, to: { opacity: "1" } },
        },
      },
    } as never);
    const model = normalizeSceneToModel(scene);
    const css = renderAnimationCss(model, { includeDataIds: true });
    expect(css).not.toContain("display: none");
    expect(css).toContain("to { opacity: 1; }");
  });

  it("emits keyframes even when includeDataIds is false (animation rules stay inline-fallback)", () => {
    const scene = createBaseScene({
      screens: { [SCREEN]: createScreen(SCREEN, "Home", [CONT]) },
      objects: {
        [SCREEN]: createScreen(SCREEN, "Home", [CONT]),
        [CONT]: createContainer(CONT, SCREEN, []),
      },
      screenOrder: [SCREEN],
      metadata: {
        name: "Test", tags: [],
        keyframes: { pulse: { from: { opacity: "0.6" }, to: { opacity: "1" } } },
      },
    } as never);
    const model = normalizeSceneToModel(scene);
    const css = renderAnimationCss(model, { includeDataIds: false });
    expect(css).toContain("@keyframes pulse {");
    expect(css).not.toContain("[data-object-id=");
  });
});
