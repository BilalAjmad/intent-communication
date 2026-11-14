import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createMCPContext, handleMCPRequest, MCPContext, MCP_TOOLS } from "./index";
import { ErrorCodes, isIntentError, IntentError } from "@intent/core";

// Structural check — zod is not a direct dependency of this package (pnpm strict),
// and importing it here would need a new dependency declaration.
function isZodError(err: unknown): boolean {
  return err instanceof Error && err.name === "ZodError" && Array.isArray((err as { issues?: unknown[] }).issues);
}

// AC-M1-03 follow-up: per-tool error-code matrix for apply_patch and validate.
//
// Reality of the current codebase (verified 2026-11-14):
//   - apply_patch surfaces E_LOCKED / E_CONFLICT / E_NOT_FOUND as structured
//     { success: false, error: <code> } results (handler short-circuit or
//     writePipeline), while storage-layer faults propagate as thrown IntentError
//     (e.g. E_IO from the atomic write) — always through writePipeline's finally,
//     so locks are released even on failure.
//   - validate does NOT parse its input at all: it casts `input as {type,data}`
//     and switches on type. Bad DATA always comes back as { valid: false,
//     error: string } with NO error code (by design). Unknown/missing `type`
//     also lands in { valid: false } via the default branch. Passing a
//     non-object input that cannot be destructured (null/undefined) throws a
//     raw TypeError from OUTSIDE the try — the handler has no input validation.
//   - E_SCHEMA is defined in ErrorCodes but emitted by NO tool handler — schema
//     validation errors surface as { valid: false } or raw ZodError from the
//     tool INPUT schemas of OTHER tools (e.g. apply_patch with a malformed
//     patch). Pinned as current behavior below ("no tool emits E_SCHEMA...").
//   - E_LOCKED / E_CONFLICT / E_IO cannot occur on validate: it holds no state,
//     acquires nothing and reads nothing. Stated here so the matrix is explicit.

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const CONTAINER = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene() {
  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN,
        type: "screen",
        parentId: null,
        children: [CONTAINER],
        props: { title: "Errors", width: 390, height: 844 },
        style: {},
        meta: {},
      },
    },
    objects: {
      [CONTAINER]: {
        id: CONTAINER,
        type: "container",
        parentId: SCREEN,
        children: [TEXT],
        props: { layout: "flex" },
        style: {},
        meta: {},
      },
      [TEXT]: {
        id: TEXT,
        type: "text",
        parentId: CONTAINER,
        children: [],
        props: { content: "Hello" },
        style: {},
        meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Errors", tags: [] },
  };
}

function patch(overrides: Record<string, unknown> = {}) {
  return {
    id: "p_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    sceneId: SCREEN,
    baseRevision: 1,
    objectId: TEXT,
    op: "set",
    path: "props.content",
    value: "Updated",
    createdAt: "2026-11-13T00:00:00.000Z",
    status: "pending",
    ...overrides,
  };
}

let testDir: string;
let context: MCPContext;

beforeAll(async () => {
  testDir = resolve(os.tmpdir(), `.test-mcp-tool-errors-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  const scenesDir = resolve(testDir, ".intent", "scenes");
  const locksDir = resolve(testDir, ".intent", "locks");
  await fs.mkdir(scenesDir, { recursive: true });
  await fs.mkdir(locksDir, { recursive: true });
  await fs.writeFile(resolve(scenesDir, `${SCREEN}.json`), JSON.stringify(makeScene()), "utf-8");
  context = createMCPContext(testDir);
});

afterAll(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

async function seedLocks(lockedObjects: string[], owners: Record<string, { pid: number; ownerToken: string; createdAt: number }> = {}) {
  await fs.writeFile(
    resolve(testDir, ".intent", "locks", `${SCREEN}.locks.json`),
    JSON.stringify({ version: 1, lockedObjects, updatedAt: new Date().toISOString(), owners }),
    "utf-8",
  );
}

describe("apply_patch — error codes", () => {
  it("E_LOCKED — target object is locked (structured result, not thrown)", async () => {
    await seedLocks([TEXT], {
      [TEXT]: { pid: process.pid, ownerToken: "owner-a", createdAt: Date.now() },
    });
    const result = (await handleMCPRequest("apply_patch", { patch: patch() }, context)) as Record<string, unknown>;
    expect(result.success).toBe(false);
    expect(result.error).toBe(ErrorCodes.E_LOCKED);
  });

  it("E_LOCKED — locked ANCESTOR blocks a descendant write (pipeline ancestor check)", async () => {
    await seedLocks([CONTAINER], {
      [CONTAINER]: { pid: process.pid, ownerToken: "owner-b", createdAt: Date.now() },
    });
    const result = (await handleMCPRequest("apply_patch", { patch: patch() }, context)) as Record<string, unknown>;
    expect(result.success).toBe(false);
    expect(result.error).toBe(ErrorCodes.E_LOCKED);
  });

  it("E_CONFLICT — stale baseRevision (structured result, not thrown)", async () => {
    await seedLocks([]);
    const result = (await handleMCPRequest(
      "apply_patch",
      { patch: patch({ baseRevision: 999 }) },
      context,
    )) as Record<string, unknown>;
    expect(result.success).toBe(false);
    expect(result.error).toBe(ErrorCodes.E_CONFLICT);
  });

  it("E_BAD_REQUEST — patch path with a forbidden root is rejected by trd 6.2 validation (throws IntentError)", async () => {
    await seedLocks([]);
    try {
      await handleMCPRequest("apply_patch", { patch: patch({ path: "admin.evil", baseRevision: 1 }) }, context);
      throw new Error("expected IntentError");
    } catch (err) {
      expect(isIntentError(err)).toBe(true);
      expect((err as { code?: string }).code).toBe(ErrorCodes.E_BAD_REQUEST);
    }
  });

  it("E_IO — storage write failure propagates as IntentError with code E_IO (fault-injected writeScene)", async () => {
    await seedLocks([]);
    const base = createMCPContext(testDir);
    const failingStorage = {
      ...base.storage,
      writeScene: async (): Promise<void> => {
        throw new IntentError(ErrorCodes.E_IO, "Atomic write failed: ENOSPC (fault injection)");
      },
    };
    const ctx = { ...base, storage: failingStorage };
    try {
      await handleMCPRequest("apply_patch", { patch: patch({ baseRevision: 1 }) }, ctx);
      throw new Error("expected IntentError");
    } catch (err) {
      expect(isIntentError(err)).toBe(true);
      expect((err as { code?: string }).code).toBe(ErrorCodes.E_IO);
    }
    // writePipeline's finally must have released the object lock (no leaked lock on failure)
    expect(await context.lockPort.isLocked(SCREEN, TEXT)).toBe(false);
  });
});

describe("validate — error surface (no error codes, by design)", () => {
  it("invalid scene data resolves to { valid: false, error: string } — never throws, never a code", async () => {
    const result = (await handleMCPRequest("validate", { type: "scene", data: { version: 2 } }, context)) as Record<string, unknown>;
    expect(result.valid).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(result).not.toHaveProperty("code");
  });

  it("invalid patch data resolves to { valid: false } — never throws", async () => {
    const result = (await handleMCPRequest("validate", { type: "patch", data: { nope: true } }, context)) as Record<string, unknown>;
    expect(result.valid).toBe(false);
    expect(typeof result.error).toBe("string");
  });

  it("a battery of garbage inputs resolves to a structured result; only null/undefined throw (raw TypeError, outside the handler's try)", async () => {
    const garbage: unknown[] = [42, "string", [], {}, { type: 42 }, { type: "nope", data: "x" }];
    for (const input of garbage) {
      const result = (await handleMCPRequest("validate", input, context)) as Record<string, unknown>;
      expect(typeof result.valid).toBe("boolean");
    }
    for (const input of [null, undefined]) {
      try {
        await handleMCPRequest("validate", input, context);
        throw new Error("expected TypeError");
      } catch (err) {
        expect(err).toBeInstanceOf(TypeError);
      }
    }
  });

  it("missing `type` does NOT throw — it resolves to { valid: false } via the default branch (handler never validates its input)", async () => {
    const result = (await handleMCPRequest("validate", { data: {} }, context)) as Record<string, unknown>;
    expect(result.valid).toBe(false);
    expect(String(result.error)).toContain("Unknown validate type");
  });

  it("valid scene data is deterministic across repeated calls", async () => {
    const scene = makeScene();
    const a = (await handleMCPRequest("validate", { type: "scene", data: scene }, context)) as Record<string, unknown>;
    const b = (await handleMCPRequest("validate", { type: "scene", data: scene }, context)) as Record<string, unknown>;
    expect(a).toEqual(b);
    expect(a.valid).toBe(true);
  });
});

describe("no tool emits E_SCHEMA (code defined but unused — pinned current state)", () => {
  it("exercising every tool with garbage inputs yields no E_SCHEMA surface", async () => {
    const garbageInputs: unknown[] = [null, undefined, 42, "x", {}, { patch: 42 }, []];
    for (const tool of MCP_TOOLS) {
      for (const input of garbageInputs) {
        try {
          await tool.handler(input, context);
        } catch (err) {
          if (isIntentError(err)) {
            expect((err as { code?: string }).code).not.toBe(ErrorCodes.E_SCHEMA);
          } else {
            expect(err).toBeInstanceOf(Error);
          }
        }
      }
    }
    // apply_patch with a schema-invalid patch id rejects with ZodError (not E_SCHEMA)
    try {
      await handleMCPRequest("apply_patch", { patch: patch({ id: "not an id" }) }, context);
      throw new Error("expected error");
    } catch (err) {
      expect(isZodError(err)).toBe(true);
      if (isIntentError(err)) expect((err as { code?: string }).code).not.toBe(ErrorCodes.E_SCHEMA);
    }
  });
});
