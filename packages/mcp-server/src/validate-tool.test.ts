import { describe, it, expect } from "vitest";
import { validateTool } from "./validate-tool";
import type { MCPContext } from "./index";

// The validate tool must now return the full lint verdict for scene data
// (schema + L1/L2 ruleset) without touching the disk (trd 10.2).

const CLEAN_SCENE = {
  version: 1,
  revision: 1,
  createdAt: "2026-11-16T00:00:00.000Z",
  updatedAt: "2026-11-16T00:00:00.000Z",
  screens: {},
  objects: {},
  screenOrder: [],
  metadata: { name: "Clean", tags: [] },
};

const SCENE_WITH_LSTATES_VIOLATION = {
  version: 1,
  revision: 1,
  createdAt: "2026-11-16T00:00:00.000Z",
  updatedAt: "2026-11-16T00:00:00.000Z",
  screens: {
    s_01ARZ3NDEKTSV4RRFFQ69G5FAV: {
      id: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      type: "screen",
      parentId: null,
      children: ["o_01ARZ3NDEKTSV4RRFFQ69G5FAV"],
      props: { title: "S", width: 1280, height: 720 },
      style: {},
      meta: {},
    },
  },
  objects: {
    s_01ARZ3NDEKTSV4RRFFQ69G5FAV: {
      id: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      type: "screen",
      parentId: null,
      children: ["o_01ARZ3NDEKTSV4RRFFQ69G5FAV"],
      props: { title: "S", width: 1280, height: 720 },
      style: {},
      meta: {},
    },
    o_01ARZ3NDEKTSV4RRFFQ69G5FAV: {
      id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      type: "button",
      parentId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      children: [],
      props: { label: "Go", variant: "primary" },
      style: {},
      meta: {},
    },
  },
  screenOrder: ["s_01ARZ3NDEKTSV4RRFFQ69G5FAV"],
  metadata: { name: "Broken", tags: [] },
};

const mockContext: MCPContext = {} as MCPContext;

describe("validate tool — scene type includes lint (trd 10.2)", () => {
  it("reports valid schema + lint pass for a clean scene", async () => {
    const result = (await validateTool.handler({ type: "scene", data: CLEAN_SCENE }, mockContext)) as {
      valid: boolean;
      lint: { pass: boolean; violations: unknown[] };
    };
    expect(result.valid).toBe(true);
    expect(result.lint.pass).toBe(true);
    expect(Array.isArray(result.lint.violations)).toBe(true);
    expect(result.lint.violations).toHaveLength(0);
  });

  it("reports lint violations with rule ids for a broken scene", async () => {
    const result = (await validateTool.handler({ type: "scene", data: SCENE_WITH_LSTATES_VIOLATION }, mockContext)) as {
      valid: boolean;
      lint: { pass: boolean; violations: { ruleId: string }[] };
    };
    expect(result.valid).toBe(true);
    expect(result.lint.pass).toBe(false);
    const ruleIds = result.lint.violations.map((v) => v.ruleId);
    expect(ruleIds).toContain("L-STATES");
  });

  it("still validates non-scene types without lint", async () => {
    const result = (await validateTool.handler(
      { type: "config", data: { version: 1, projectName: "x", previewPort: 3456, studioPort: 3457, mcpPort: 3458, maxBytes: 32768, autoSave: true, lockTTL: 30000 } },
      mockContext,
    )) as { valid: boolean; lint?: unknown };
    expect(result.valid).toBe(true);
    expect(result.lint).toBeUndefined();
  });

  it("reports schema failure without lint for an invalid scene", async () => {
    const result = (await validateTool.handler({ type: "scene", data: { not: "a scene" } }, mockContext)) as {
      valid: boolean;
      error?: string;
    };
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
