import { describe, it, expect } from "vitest";
import { ButtonSchema, ConfigSchema } from "./index";

const base = {
  id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  type: "button",
  parentId: null as string | null,
  children: [],
  props: { label: "Go" },
  style: {},
  meta: {},
};

describe("responsive overrides (trd 4.4)", () => {
  it("defaults responsive to an empty map", () => {
    const parsed = ButtonSchema.parse(base);
    expect(parsed.responsive).toEqual({});
  });

  it("parses sm/md/lg overrides with style, layout, size, position, visible", () => {
    const parsed = ButtonSchema.parse({
      ...base,
      responsive: {
        sm: {
          style: { padding: "16px" },
          layout: { direction: "row", gap: 8 },
          size: { width: "100%", height: 48 },
          position: { x: 10, y: 20 },
          visible: true,
        },
        lg: { visible: false },
      },
    });
    expect(parsed.responsive.sm?.layout?.gap).toBe(8);
    expect(parsed.responsive.sm?.size?.height).toBe(48);
    expect(parsed.responsive.lg?.visible).toBe(false);
  });

  it("rejects unknown keys inside an override (strict)", () => {
    const result = ButtonSchema.safeParse({
      ...base,
      responsive: { sm: { bogus: true } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown breakpoints", () => {
    const result = ButtonSchema.safeParse({
      ...base,
      responsive: { xl: { style: {} } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid layout enums", () => {
    const result = ButtonSchema.safeParse({
      ...base,
      responsive: { sm: { layout: { direction: "diagonal" } } },
    });
    expect(result.success).toBe(false);
  });

  it("config schema defaults breakpoints to 640/1024/1440 and keeps them overridable", () => {
    const defaults = ConfigSchema.parse({ version: 1 });
    expect(defaults.breakpoints).toEqual({ sm: 640, md: 1024, lg: 1440 });
    const custom = ConfigSchema.parse({ version: 1, breakpoints: { sm: 700, md: 1100, lg: 1500 } });
    expect(custom.breakpoints.sm).toBe(700);
  });
});
