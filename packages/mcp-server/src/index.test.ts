import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMCPContext,
  handleMCPRequest,
  getMCPTool,
  MCP_TOOLS,
} from "./index";
import { Scene, Patch, Lock, Feedback, Config } from "@intent/schema";

describe("MCP Server", () => {
  const testDir = "H:\\intent-communication\\.test-mcp";
  let context: ReturnType<typeof createMCPContext>;

  beforeEach(() => {
    context = createMCPContext(testDir);
  });

  describe("createMCPContext", () => {
    it("creates context with all required components", () => {
      expect(context.projectRoot).toBe(testDir);
      expect(context.storage).toBeDefined();
      expect(context.lockPort).toBeDefined();
      expect(context.crypto).toBeDefined();
    });
  });

  describe("MCP_TOOLS", () => {
    it("has 6 tools", () => {
      expect(MCP_TOOLS.length).toBe(6);
    });

    it("includes all required tools", () => {
      const names = MCP_TOOLS.map((t) => t.name);
      expect(names).toContain("get_scene");
      expect(names).toContain("apply_patch");
      expect(names).toContain("get_feedback");
      expect(names).toContain("ask_user");
      expect(names).toContain("open_studio");
      expect(names).toContain("validate");
    });

    it("each tool has name, description, inputSchema, handler", () => {
      for (const tool of MCP_TOOLS) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(typeof tool.handler).toBe("function");
      }
    });
  });

  describe("getMCPTool", () => {
    it("returns tool by name", () => {
      const tool = getMCPTool("get_scene");
      expect(tool).toBeDefined();
      expect(tool?.name).toBe("get_scene");
    });

    it("returns undefined for unknown tool", () => {
      const tool = getMCPTool("unknown_tool");
      expect(tool).toBeUndefined();
    });
  });

  describe("handleMCPRequest", () => {
    it("throws for unknown tool", async () => {
      await expect(handleMCPRequest("unknown", {}, context)).rejects.toThrow();
    });
  });

  describe("getSceneTool", () => {
    it("returns scene not found for missing scene", async () => {
      await expect(
        handleMCPRequest("get_scene", { objectIds: [] }, context)
      ).rejects.toThrow();
    });
  });

  describe("validateTool", () => {
    it("validates a valid scene", async () => {
      const scene = {
        version: 1,
        revision: 0,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        screens: {},
        objects: {},
        screenOrder: [],
        metadata: { name: "Test", tags: [] },
      };
      const result = await handleMCPRequest("validate", { type: "scene", data: scene }, context);
      expect(result.valid).toBe(true);
    });

    it("rejects invalid scene", async () => {
      const result = await handleMCPRequest("validate", { type: "scene", data: { version: 2 } }, context);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("validates a valid patch", async () => {
      const patch = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        sceneId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        baseRevision: 0,
        objectId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d",
        op: "set",
        path: "props.content",
        value: "Test",
        createdAt: "2026-11-02T22:38:00.000Z",
        status: "pending",
      };
      const result = await handleMCPRequest("validate", { type: "patch", data: patch }, context);
      expect(result.valid).toBe(true);
    });

    it("rejects invalid patch", async () => {
      const patch = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        sceneId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        baseRevision: 0,
        objectId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d",
        op: "invalid_op",
        path: "props.content",
        createdAt: "2026-11-02T22:38:00.000Z",
      };
      const result = await handleMCPRequest("validate", { type: "patch", data: patch }, context);
      expect(result.valid).toBe(false);
    });
  });

  describe("openStudioTool", () => {
    it("returns studio URL", async () => {
      const sceneId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const result = await handleMCPRequest("open_studio", { sceneId, userRequested: true }, context);
      expect(result.url).toContain("http://localhost:3457");
      expect(result.url).toContain(`scene=${sceneId}`);
      expect(result.sessionId).toBeDefined();
    });
  });

  describe("getFeedbackTool", () => {
    it("returns empty feedback for missing scene", async () => {
      const sceneId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const result = await handleMCPRequest("get_feedback", { sceneId }, context);
      expect(result.feedback).toEqual([]);
    });
  });

  describe("askUserTool", () => {
    it("returns question structure", async () => {
      const result = await handleMCPRequest("ask_user", {
        questionId: "q1",
        kind: "choice",
        prompt: "Choose a layout",
        options: [
          { value: "a", label: "Option A" },
          { value: "b", label: "Option B" },
        ],
      }, context);
      expect(result.answer).toBeNull();
      expect(result.meter).toBe(0);
      expect(result.nextQuestion).toBeDefined();
    });
  });

  describe("applyPatchTool", () => {
    it("throws not found for missing scene", async () => {
      const patch: Patch = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        sceneId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a",
        baseRevision: 0,
        objectId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        op: "set",
        path: "props.content",
        value: "Test",
        createdAt: "2026-11-02T22:38:00.000Z",
        status: "pending",
      };
      await expect(handleMCPRequest("apply_patch", { patch }, context)).rejects.toThrow("Scene not found");
    });
  });
});