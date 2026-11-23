import { describe, it, expect } from "vitest";
import Ajv2020 from "ajv/dist/2020.js";
import { GetFeedbackInputSchema } from "@intent/schema";
import { MCP_TOOL_DESCRIPTORS, getMCPTool } from "./index";

// tools/list descriptors (trd 14.3): every descriptor's inputSchema accepts a
// valid example and rejects an invalid one — checked with ajv (draft-07,
// validateFormats off: date-time assertions are zod's job, not this test's).
// For the five Zod-derived tools the same examples are also cross-checked
// against the Zod source of truth. `validate` is the documented
// hand-written-JSON-Schema exception (see isZodSchema in index.ts): it has no
// Zod input schema by design (tool-errors.test.ts), so ajv gets exercises the
// hand-written document instead of a zod oracle.

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });

const VALID: Record<string, unknown> = {
  get_scene: {},
  apply_patch: {
    patch: {
      id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      sceneId: "default",
      baseRevision: 0,
      objectId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      op: "set",
      path: "props.content",
      value: "Hello",
      createdAt: "2026-11-15T00:00:00.000Z",
    },
  },
  get_feedback: { sceneId: "default" },
  ask_user: { questionId: "q1", kind: "choice", prompt: "Which look?", options: [{ value: "a", label: "A" }] },
  open_studio: { sceneId: "default", userRequested: true },
  create_object: { sceneId: "default", type: "text", parentId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV" },
  delete_object: { sceneId: "default", objectId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV" },
  validate: { type: "scene", data: {} },
};

const INVALID: Record<string, unknown> = {
  get_scene: { depth: 99 },
  apply_patch: {
    patch: {
      id: "not-an-id",
      sceneId: "default",
      baseRevision: 0,
      objectId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      op: "set",
      path: "props.content",
      createdAt: "2026-11-15T00:00:00.000Z",
    },
  },
  get_feedback: { sceneId: 42 },
  ask_user: { questionId: "q1", kind: "nonsense", prompt: "Which look?" },
  open_studio: { sceneId: "default" },
  create_object: { sceneId: "default", type: "not-a-type" },
  delete_object: { sceneId: "default", objectId: "not-an-id" },
  validate: { type: "not-a-kind", data: {} },
};

const ZOD_DERIVED = new Set(["get_scene", "apply_patch", "get_feedback", "ask_user", "open_studio", "create_object", "delete_object"]);

describe("MCP_TOOL_DESCRIPTORS (tools/list inputSchema roundtrip)", () => {
  it("lists exactly the six tools in the contract", () => {
    expect(MCP_TOOL_DESCRIPTORS.map((d) => d.name).sort()).toEqual(
      ["apply_patch", "ask_user", "create_object", "delete_object", "get_feedback", "get_scene", "open_studio", "validate"],
    );
  });

  for (const descriptor of MCP_TOOL_DESCRIPTORS) {
    describe(descriptor.name, () => {
      const validate = ajv.compile(descriptor.inputSchema);

      it("inputSchema is a JSON Schema object with type object", () => {
        expect(descriptor.inputSchema.type).toBe("object");
      });

      it("generated inputSchema accepts a valid example", () => {
        expect(validate(VALID[descriptor.name]), JSON.stringify(validate.errors)).toBe(true);
      });

      it("generated inputSchema rejects an invalid example", () => {
        expect(validate(INVALID[descriptor.name])).toBe(false);
      });

      if (ZOD_DERIVED.has(descriptor.name)) {
        it("the same valid example passes the Zod source of truth", () => {
          const tool = getMCPTool(descriptor.name);
          expect(tool).toBeDefined();
          const parsed = (tool!.inputSchema as { safeParse: (d: unknown) => { success: boolean } }).safeParse(
            VALID[descriptor.name],
          );
          expect(parsed.success).toBe(true);
        });

        it("the same invalid example fails the Zod source of truth", () => {
          const tool = getMCPTool(descriptor.name);
          const parsed = (tool!.inputSchema as { safeParse: (d: unknown) => { success: boolean } }).safeParse(
            INVALID[descriptor.name],
          );
          expect(parsed.success).toBe(false);
        });
      }

      it("description is at most 120 words", () => {
        expect(descriptor.description.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(120);
      });
    });
  }

  it("get_feedback rejects objectIds arrays longer than 50 (GHSA-mrhx-c7xc-m3w5 mitigation)", () => {
    const fiftyOne = Array.from({ length: 51 }, () => "o_01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(GetFeedbackInputSchema.safeParse({ sceneId: "default", objectIds: fiftyOne }).success).toBe(false);
    const fifty = fiftyOne.slice(0, 50);
    expect(GetFeedbackInputSchema.safeParse({ sceneId: "default", objectIds: fifty }).success).toBe(true);
  });

  it("all eight descriptions together are at most 1100 words (trd 10.1)", () => {
    const total = MCP_TOOL_DESCRIPTORS.reduce(
      (sum, d) => sum + d.description.split(/\s+/).filter(Boolean).length,
      0,
    );
    expect(total).toBeLessThanOrEqual(1100);
  });
});
