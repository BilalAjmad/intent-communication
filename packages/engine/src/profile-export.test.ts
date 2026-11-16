import { describe, it, expect } from "vitest";
import { exportToReact } from "./index";
import type { Scene } from "@intent/schema";
import { createBaseScene, createScreen, createContainer, createText } from "../tests/test-helpers";

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const CONT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";

const PROFILE = {
  tokens: {
    colors: { primary: "#2563eb", surface: "#f8f9fa" },
    spacing: { md: "16px" },
    radii: { md: "8px" },
  },
};

function scene(): Scene {
  return createBaseScene({
    screens: { [SCREEN]: createScreen(SCREEN, "Home", [CONT]) },
    objects: {
      [SCREEN]: createScreen(SCREEN, "Home", [CONT]),
      [CONT]: {
        ...createContainer(CONT, SCREEN, [TEXT]),
        style: { padding: "16px", backgroundColor: "#f8f9fa", borderRadius: "8px" },
      },
      [TEXT]: {
        ...createText(TEXT, CONT, "Hello", {} as never),
        style: { backgroundColor: "#2563eb" },
      },
    },
    screenOrder: [SCREEN],
  } as never);
}

describe("design profile → Tailwind classes (trd 13.7)", () => {
  it("emits Tailwind utilities for exact matches and drops the inline style for them", () => {
    const files = exportToReact(scene(), { designProfile: PROFILE });
    const home = files["intent-export/screens/Home.tsx"] as string;
    expect(home).toContain("p-md");
    expect(home).toContain("bg-surface");
    expect(home).toContain("rounded-md");
    expect(home).toContain("bg-primary");
  });

  it("falls back to CSS-var inline styles for unmatched values", () => {
    const files = exportToReact(scene());
    const home = files["intent-export/screens/Home.tsx"] as string;
    expect(home).toContain('"padding": "16px"');
    expect(home).not.toContain("p-md");
  });
});
