import { describe, it, expect } from "vitest";
import { ButtonSchema, STATE_NAMES, validateScene } from "./index";

const base = {
  id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  type: "button",
  parentId: null as string | null,
  children: [],
  props: { label: "Go" },
  style: {},
  meta: {},
};

describe("states (trd 5.3)", () => {
  it("exposes exactly the 14 spec state names", () => {
    expect([...STATE_NAMES].sort()).toEqual(
      [
        "checked", "content", "disabled", "empty", "error", "filled", "focus",
        "hover", "loading", "open", "pressed", "submitting", "success", "visited",
      ].sort(),
    );
  });

  it("defaults states to an empty map", () => {
    const parsed = ButtonSchema.parse(base);
    expect(parsed.states).toEqual({});
  });

  it("parses hover and error overrides with style and visible", () => {
    const parsed = ButtonSchema.parse({
      ...base,
      states: {
        hover: { style: { background: "#ff0000" } },
        error: { style: { borderColor: "#ff0000" }, visible: false },
      },
    });
    expect(parsed.states.hover?.style?.background).toBe("#ff0000");
    expect(parsed.states.error?.visible).toBe(false);
  });

  it("rejects an unknown state name", () => {
    const result = ButtonSchema.safeParse({ ...base, states: { bogus: {} } });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys inside a state override (strict object)", () => {
    const result = ButtonSchema.safeParse({ ...base, states: { hover: { bogus: true } } });
    expect(result.success).toBe(false);
  });

  it("rejects oversized override text", () => {
    const result = ButtonSchema.safeParse({
      ...base,
      states: { hover: { text: "x".repeat(2001) } },
    });
    expect(result.success).toBe(false);
  });

  it("validateScene accepts a scene with states", () => {
    const screenId = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const scene = {
      version: 1,
      revision: 1,
      createdAt: "2026-11-16T00:00:00.000Z",
      updatedAt: "2026-11-16T00:00:00.000Z",
      screens: {
        [screenId]: {
          id: screenId, type: "screen", parentId: null, children: [],
          props: { title: "S", width: 1280, height: 720 },
          style: {}, meta: {},
        },
      },
      objects: {
        [screenId]: {
          id: screenId, type: "screen", parentId: null, children: [],
          props: { title: "S", width: 1280, height: 720 },
          style: {}, meta: {},
        },
      },
      screenOrder: [screenId],
      metadata: { name: "S", tags: [] },
    };
    expect(() => validateScene(scene)).not.toThrow();
  });
});
