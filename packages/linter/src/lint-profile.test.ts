import { describe, it, expect } from "vitest";
import { lintScene } from "./index";
import type { Scene } from "@intent/schema";

// trd 16 / trd 17.1 — profile-aware linting: the linter reads
// .intent/design-profile.json (passed in by the caller) and (a) suggests the
// nearest matching profile token for raw color literals, (b) resolves the
// profile's color tokens for WCAG contrast verification.
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function textScene(style: Record<string, unknown>): Scene {
  return {
    version: 1, revision: 1,
    createdAt: "2026-11-18T00:00:00.000Z", updatedAt: "2026-11-18T00:00:00.000Z",
    screens: {
      [SCREEN]: { id: SCREEN, type: "screen", parentId: null, children: [TXT], props: { title: "Home", width: 390, height: 844 }, style: {}, meta: {} },
    },
    objects: {
      [SCREEN]: { id: SCREEN, type: "screen", parentId: null, children: [TXT], props: { title: "Home", width: 390, height: 844 }, style: {}, meta: {} },
      [TXT]: { id: TXT, type: "text", parentId: SCREEN, children: [], props: { content: "Hello", fontSize: 16 }, style, meta: {} },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Lint Profile Test", tags: [] },
  } as Scene;
}

const PROFILE = {
  tokens: { colors: { primary: "#2563eb", surface: "#ffffff", brand: "#000000", onBrand: "#111111" } },
};

describe("L-TOKEN with design profile (trd 16, nearest matching token)", () => {
  it("suggests the nearest profile token for a raw hex literal", () => {
    const scene = textScene({ color: "#2464ec" }); // within one step of #2563eb
    const result = lintScene(scene, [], PROFILE);
    const token = result.violations.find((v) => v.ruleId === "L-TOKEN");
    expect(token).toBeDefined();
    expect(token?.suggestion).toContain("token.color.primary");
    expect(token?.suggestion).toContain("#2563eb");
  });

  it("keeps the generic suggestion when no profile is provided", () => {
    const scene = textScene({ color: "#2464ec" });
    const result = lintScene(scene);
    const token = result.violations.find((v) => v.ruleId === "L-TOKEN");
    expect(token?.suggestion).toBe("Reference a named color token instead of a raw value");
  });

  it("ignores profile entries that are not parseable hex colors", () => {
    const scene = textScene({ color: "#2464ec" });
    const result = lintScene(scene, [], { tokens: { colors: { nonsense: "blue-ish" } } });
    const token = result.violations.find((v) => v.ruleId === "L-TOKEN");
    expect(token?.suggestion).toBe("Reference a named color token instead of a raw value");
  });
});

describe("L-CONTRAST with design profile (contrast pairs from the profile)", () => {
  it("resolves profile tokens for contrast verification — identical colors are flagged", () => {
    // brand (#000000) on onBrand (#111111): both resolve ONLY with the profile.
    const scene = textScene({ color: "token.color.brand", background: "token.color.onBrand" });
    const withProfile = lintScene(scene, [], PROFILE);
    const contrast = withProfile.violations.find((v) => v.ruleId === "L-CONTRAST");
    expect(contrast).toBeDefined();
    expect(contrast?.message).toContain("Contrast ratio");

    // Without the profile the tokens are unresolvable — the honest fallback warning.
    const withoutProfile = lintScene(scene);
    const fallback = withoutProfile.violations.find((v) => v.ruleId === "L-CONTRAST");
    expect(fallback?.message).toContain("both use color tokens");
  });

  it("passes contrast for profile tokens with enough separation", () => {
    const scene = textScene({ color: "token.color.primary", background: "token.color.surface" });
    const result = lintScene(scene, [], PROFILE);
    expect(result.violations.find((v) => v.ruleId === "L-CONTRAST")).toBeUndefined();
  });
});
