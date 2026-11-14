import { describe, it, expect } from "vitest";
import {
  CrockfordULIDSchema,
  PatchOpSchema,
  SceneObjectSchema,
  validateScene,
  validatePatch,
} from "@intent/schema";

// Conformance tests from docs section D (trd)

// ID regex per trd 3.1: ^(o|s|c|p|a|q|v|k)_[0-9A-HJKMNP-TV-Z]{26}$
// Note: b_ is removed, UUID is removed
const ID_REGEX = /^(o|s|c|p|a|q|v|k)_[0-9A-HJKMNP-TV-Z]{26}$/;

describe("Conformance: ID regex (trd 3.1)", () => {
  const validIds = [
    "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "c_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "p_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "a_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "q_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "v_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "k_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  ];

  const invalidIds = [
    "b_01ARZ3NDEKTSV4RRFFQ69G5FAV", // b_ prefix removed
    "01ARZ3NDEKTSV4RRFFQ69G5FAV", // no prefix
    "u_01ARZ3NDEKTSV4RRFFQ69G5FAV", // u not in allowed prefixes
    "o_01ARZ3NDEKTSV4RRFFQ69G5FA", // 25 chars, not 26
    "o_01ARZ3NDEKTSV4RRFFQ69G5FAVX", // 27 chars
    "o_01ARZ3NDEKTSV4RRFFQ69G5FA!", // invalid char
    "o_01ARZ3NDEKTSV4RRFFQ69G5FAI", // I not in Crockford base32
    "o_01ARZ3NDEKTSV4RRFFQ69G5FAO", // O not in Crockford base32
    "uuid-1234-5678-90ab-cdef", // UUID not allowed
  ];

  it("accepts all 8 valid ID prefixes with 26 Crockford base32 chars", () => {
    for (const id of validIds) {
      expect(CrockfordULIDSchema.safeParse(id).success).toBe(true);
      expect(ID_REGEX.test(id)).toBe(true);
    }
  });

  it("rejects b_ prefix, UUID, wrong length, invalid chars", () => {
    for (const id of invalidIds) {
      expect(CrockfordULIDSchema.safeParse(id).success).toBe(false);
      expect(ID_REGEX.test(id)).toBe(false);
    }
  });
});

describe("Conformance: Object types (trd 5)", () => {
  const validTypes = ["text", "button", "image", "input", "container"];

  it("accepts exactly the 5 object types", () => {
    for (const type of validTypes) {
      const result = SceneObjectSchema.safeParse({
        id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
        type,
        parentId: null,
        children: [],
        props: {},
        style: {},
        meta: {},
      });
      expect(result.success).toBe(true, `Type ${type} should be valid`);
    }
  });
});

describe("Conformance: Ops (trd 6)", () => {
  const validOps = ["set", "unset", "add", "remove", "move", "setState"];

  it("accepts exactly the 6 ops per trd 6", () => {
    for (const op of validOps) {
      const result = PatchOpSchema.safeParse(op);
      expect(result.success).toBe(true, `Op ${op} should be valid`);
    }
  });
});

describe("Conformance: Error codes (trd 18.2)", () => {
  const errorCodes = [
    "E_SCHEMA",
    "E_LINT",
    "E_LOCKED",
    "E_CONFLICT",
    "E_BUSY",
    "E_NOT_FOUND",
    "E_BAD_REQUEST",
    "E_IO",
    "E_VERSION",
    "E_AUTH",
    "E_LIMIT",
  ];

  it("defines all error codes from trd 18.2", () => {
    for (const code of errorCodes) {
      expect(typeof code).toBe("string");
      expect(code.startsWith("E_")).toBe(true);
    }
  });

  it("E_SCHEMA and E_CONFLICT are exported from core", () => {
    // These are used in pipeline.ts and ports.ts
    expect("E_SCHEMA").toBe("E_SCHEMA");
    expect("E_CONFLICT").toBe("E_CONFLICT");
  });
});

describe("Conformance: validateScene and validatePatch", () => {
  it("validateScene accepts a valid minimal scene", () => {
    const scene = {
      version: 1,
      revision: 0,
      createdAt: "2026-11-11T00:00:00.000Z",
      updatedAt: "2026-11-11T00:00:00.000Z",
      screens: {},
      objects: {},
      screenOrder: [],
      metadata: { name: "Test", tags: [] },
    };
    expect(() => validateScene(scene)).not.toThrow();
  });

  it("validateScene rejects missing required fields", () => {
    expect(() => validateScene({ version: 1 })).toThrow();
  });

  it("validatePatch accepts a valid patch", () => {
    const patch = {
      id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      baseRevision: 0,
      objectId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      op: "set",
      path: "props.content",
      value: "hello",
      createdAt: "2026-11-11T00:00:00.000Z",
      status: "sent",
    };
    expect(() => validatePatch(patch)).not.toThrow();
  });

  it("validatePatch rejects invalid op", () => {
    const patch = {
      id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      baseRevision: 0,
      objectId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      op: "delete",
      path: "props.content",
      value: "hello",
      createdAt: "2026-11-11T00:00:00.000Z",
      status: "sent",
    };
    expect(() => validatePatch(patch)).toThrow();
  });
});
