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
});
