import { describe, it, expect } from "vitest";
import { mapStyleToClasses, type DesignProfileLike } from "./tailwind-map.js";

const PROFILE: DesignProfileLike = {
  tokens: {
    colors: { primary: "#2563eb", surface: "#f8f9fa", accent_dine: "#ff0000" },
    spacing: { md: "16px", lg: "24px" },
    radii: { md: "8px" },
  },
};

describe("mapStyleToClasses (trd 13.7)", () => {
  it("maps exact hex colors by property to tailwind prefixes", () => {
    const { classes, rest } = mapStyleToClasses(
      { "background-color": "#2563eb", color: "#2563eb", borderColor: "#f8f9fa", outlineColor: "#2563eb" },
      PROFILE,
    );
    expect(classes).toEqual(expect.arrayContaining(["bg-primary", "text-primary", "border-surface", "outline-primary"]));
    expect(rest).toEqual({});
  });

  it("keeps unmatched colors as inline CSS vars", () => {
    const { classes, rest } = mapStyleToClasses({ color: "#123456" }, PROFILE);
    expect(classes).toEqual([]);
    expect(rest).toEqual({ color: "#123456" });
  });

  it("maps exact px spacing to spacing tokens", () => {
    const { classes, rest } = mapStyleToClasses(
      { padding: "16px", gap: "24px", width: "16px" },
      PROFILE,
    );
    expect(classes).toEqual(expect.arrayContaining(["p-md", "gap-lg", "w-md"]));
    expect(rest).toEqual({});
  });

  it("maps border-radius px to the radii token", () => {
    const { classes, rest } = mapStyleToClasses({ borderRadius: "8px" }, PROFILE);
    expect(classes).toContain("rounded-md");
    expect(rest).toEqual({});
  });

  it("sanitizes underscores in class keys (scanner CSS-variable names)", () => {
    const profile: DesignProfileLike = { tokens: { colors: { accent_dine: "#ff0000" }, spacing: {}, radii: {} } };
    const { classes } = mapStyleToClasses({ color: "#ff0000" }, profile);
    expect(classes).toContain("text-accent-dine");
  });

  it("is a no-op without a profile", () => {
    const { classes, rest } = mapStyleToClasses({ color: "#2563eb" }, undefined as unknown as DesignProfileLike);
    expect(classes).toEqual([]);
    expect(rest).toEqual({ color: "#2563eb" });
  });

  it("never emits underscored arbitrary-value classes for token paths (dots)", () => {
    const profile: DesignProfileLike = { tokens: { colors: { "blue.400": "#2563eb" }, spacing: {}, radii: {} } };
    const { classes } = mapStyleToClasses({ color: "#2563eb" }, profile);
    expect(classes).toContain("text-[blue.400]");
  });
});
