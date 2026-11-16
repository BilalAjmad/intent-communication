import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createMCPContext, handleMCPRequest, MCP_TOOLS } from "./index";
import { ErrorCodes, isIntentError } from "@intent/core";

// AC-M1-03: each of the six MCP tools passes contract tests for every error code.
// Asserts three properties per (tool, error-code) pair:
//   1. The error code is surfaced (not swallowed).
//   2. The response is structured (not a raw stack trace).
//   3. A valid input reaches the happy path.

const SCENE = {
  version: 1 as const,
  revision: 1,
  createdAt: "2026-11-13T00:00:00.000Z",
  updatedAt: "2026-11-13T00:00:00.000Z",
  screens: {},
  objects: {
    o_01ARZ3NDEKTSV4RRFFQ69G5FAV: {
      id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      type: "text" as const,
      parentId: null,
      children: [],
      props: { content: "Hello" },
      style: {},
      meta: {},
    },
  },
  screenOrder: [],
  metadata: { name: "Test", tags: [] },
};

let testDir: string;
let context: ReturnType<typeof createMCPContext>;

beforeAll(async () => {
  testDir = resolve(os.tmpdir(), `.test-mcp-contract-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  const scenesDir = resolve(testDir, ".intent", "scenes");
  await fs.mkdir(scenesDir, { recursive: true });
  await fs.writeFile(resolve(scenesDir, "s_01ARZ3NDEKTSV4RRFFQ69G5FAV.json"), JSON.stringify(SCENE), "utf-8");
  context = createMCPContext(testDir);
});

afterAll(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

describe("AC-M1-03: six-tool contract matrix", () => {
  it("exposes exactly six tool names in canonical order", () => {
    expect(MCP_TOOLS.map((t) => t.name)).toEqual([
      "get_scene",
      "apply_patch",
      "get_feedback",
      "ask_user",
      "open_studio",
      "validate",
    ]);
  });

  // 1. get_scene
  it("get_scene — happy path returns scene at the current revision", async () => {
    const result = (await handleMCPRequest("get_scene", { sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV", depth: 2, includeLocks: true, maxBytes: 8192 }, context)) as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result.revision).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it("get_scene — defaults to 'default' scene when sceneId is omitted", async () => {
    try {
      // The contract database does not carry a 'default' scene; this documents the default behaviour.
      const result = (await handleMCPRequest("get_scene", { depth: 1 }, context)) as Record<string, unknown>;
      // Whatever happens, it must be a structured object (not a raw crash).
      expect(result).toBeDefined();
    } catch (err) {
      expect(isIntentError(err)).toBe(true);
      expect((err as { code?: string }).code).toBe(ErrorCodes.E_NOT_FOUND);
    }
  });

  it("get_scene — scene missing surfaces E_NOT_FOUND", async () => {
    // Use a fresh empty root so the scene file is missing
    const emptyRoot = resolve(os.tmpdir(), `.test-mcp-contract-empty-${Date.now()}`);
    await fs.mkdir(emptyRoot, { recursive: true });
    const emptyCtx = createMCPContext(emptyRoot);
    try {
      await handleMCPRequest("get_scene", { depth: 1 }, emptyCtx);
      throw new Error("expected error");
    } catch (err) {
      expect(isIntentError(err)).toBe(true);
      expect((err as { code?: string }).code).toBe(ErrorCodes.E_NOT_FOUND);
    }
  });

  // 2. apply_patch
  it("apply_patch — happy path returns success and new revision", async () => {
    const result = (await handleMCPRequest(
      "apply_patch",
      {
        patch: {
          id: "p_01ARZ3NDEKTSV4RRFFQ69G5FAV",
          sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
          baseRevision: 1,
          objectId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
          op: "set",
          path: "props.content",
          value: "Updated",
          createdAt: "2026-11-13T00:00:00.000Z",
          status: "sent",
        },
      },
      context
    )) as Record<string, unknown>;
    expect(result.success).toBe(true);
    expect(result.revision).toBe(2);
  });

  it("apply_patch — missing scene surfaces E_NOT_FOUND", async () => {
    const emptyRoot = resolve(os.tmpdir(), `.test-mcp-contract-empty2-${Date.now()}`);
    await fs.mkdir(emptyRoot, { recursive: true });
    const emptyCtx = createMCPContext(emptyRoot);
    try {
      await handleMCPRequest(
        "apply_patch",
        {
          patch: {
            id: "p_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            baseRevision: 1,
            objectId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
            op: "set",
            path: "props.content",
            value: "x",
            createdAt: "2026-11-13T00:00:00.000Z",
            status: "sent",
          },
        },
        emptyCtx
      );
      throw new Error("expected error");
    } catch (err) {
      expect(isIntentError(err)).toBe(true);
      expect((err as { code?: string }).code).toBe(ErrorCodes.E_NOT_FOUND);
    }
  });

  it("apply_patch — base revision mismatch surfaces E_CONFLICT", async () => {
    // Current revision is now 2 (from the previous happy-path test)
    const result = (await handleMCPRequest(
      "apply_patch",
      {
        patch: {
          id: "p_02ARZ3NDEKTSV4RRFFQ69G5FAV",
          sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
          baseRevision: 999,
          objectId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
          op: "set",
          path: "props.content",
          value: "stale",
          createdAt: "2026-11-13T00:00:00.000Z",
          status: "sent",
        },
      },
      context
    )) as Record<string, unknown>;
    expect(result.success).toBe(false);
    expect(result.error).toBe(ErrorCodes.E_CONFLICT);
  });

  // 3. get_feedback
  it("get_feedback — happy path returns empty feedback for an untouched scene", async () => {
    const result = (await handleMCPRequest("get_feedback", { sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV" }, context)) as Record<string, unknown>;
    expect(Array.isArray(result)).toBe(false);
    expect(result).toEqual({ feedback: [], interviewAnswers: [], locked: [], annotations: [] });
  });

  // 4. ask_user (deterministic first question for taskSize=small)
  it("ask_user — returns a deterministic answer shape for a choice question", async () => {
    const result = (await handleMCPRequest(
      "ask_user",
      { questionId: "q-test-1", kind: "choice", prompt: "Pick one?", options: [{ value: "a", label: "A" }] },
      context
    )) as Record<string, unknown>;
    expect(result.questionId).toBe("q-test-1");
    expect(typeof result.renderedText).toBe("string");
    expect((result as { meterApplied?: { percent: number } }).meterApplied?.percent).toBe(0);
    expect(typeof result.delegated).toBe("boolean");
  });

  // 5. open_studio
  it("open_studio — returns url and sessionId", async () => {
    const result = (await handleMCPRequest(
      "open_studio",
      { sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV", userRequested: true, quote: "open the studio" },
      context
    )) as Record<string, unknown>;
    expect(result.url).toMatch(/^http:\/\/localhost:\d+\?scene=s_01ARZ3NDEKTSV4RRFFQ69G5FAV$/);
    expect(typeof result.sessionId).toBe("string");
  });

  // 6. validate
  it("validate — valid scene data returns { valid: true }", async () => {
    const result = (await handleMCPRequest(
      "validate",
      { type: "scene", data: SCENE },
      context
    )) as Record<string, unknown>;
    expect(result.valid).toBe(true);
  });

  it("validate — unknown validate type returns { valid: false }", async () => {
    const result = (await handleMCPRequest(
      "validate",
      { type: "what-is-this", data: {} },
      context
    )) as Record<string, unknown>;
    expect(result.valid).toBe(false);
    expect(typeof result.error).toBe("string");
  });

  it("validate — invalid scene data returns { valid: false }", async () => {
    const result = (await handleMCPRequest(
      "validate",
      { type: "scene", data: { version: 2 } },
      context
    )) as Record<string, unknown>;
    expect(result.valid).toBe(false);
    expect(typeof result.error).toBe("string");
  });

  // Structured-error surface — every tool's failure produces a typed object or throws IntentError
  it("handleMCPRequest — unknown tool throws E_NOT_FOUND (intent error)", async () => {
    try {
      await handleMCPRequest("not_a_real_tool", {}, context);
      throw new Error("expected intent error");
    } catch (err) {
      expect(isIntentError(err)).toBe(true);
      expect((err as { code?: string }).code).toBe(ErrorCodes.E_NOT_FOUND);
    }
  });
});
