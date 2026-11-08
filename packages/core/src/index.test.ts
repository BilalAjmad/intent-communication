import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createStoragePort,
  createLockPort,
  createCryptoPort,
  normalizeScene,
  applyPatch,
  writePipeline,
  IntentError,
  ErrorCodes,
  isIntentError,
} from "./index";
import { Scene, Patch, Lock, LocksFile, Config, Profile, InterviewState, Brief, Feedback } from "@intent/schema";
import { promises as fs } from "node:fs";

describe("Core package", () => {
  const testDir = require("os").tmpdir() + "/.test-intent";
  let storage: ReturnType<typeof createStoragePort>;
  let lockPort: ReturnType<typeof createLockPort>;

  beforeEach(async () => {
    // Clean up test directory before each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore errors if directory doesn't exist
    }
    storage = createStoragePort(testDir);
    lockPort = createLockPort(storage);
  });

  describe("StoragePort", () => {
    it("reads and writes scene", async () => {
      const scene: Scene = {
        version: 1,
        revision: 0,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        screens: {},
        objects: {},
        screenOrder: [],
        metadata: { name: "Test", tags: [] },
      };
      await storage.writeScene("scene-1", scene);
      const read = await storage.readScene("scene-1");
      expect(read).toEqual(scene);
    });

    it("returns null for missing scene", async () => {
      const read = await storage.readScene("missing");
      expect(read).toBeNull();
    });

    it("reads and writes locks", async () => {
      const locks: LocksFile = {
        version: 1,
        locks: {},
        updatedAt: "2026-11-02T22:38:00.000Z",
      };
      await storage.writeLocks("scene-1", locks);
      const read = await storage.readLocks("scene-1");
      expect(read.version).toBe(1);
    });

    it("reads and writes config", async () => {
      const config: Config = {
        version: 1,
        projectName: "Test",
        previewPort: 3456,
        studioPort: 3457,
        mcpPort: 3458,
        maxBytes: 32768,
        autoSave: true,
        lockTTL: 30000,
      };
      await storage.writeConfig(config);
      const read = await storage.readConfig();
      expect(read.projectName).toBe("Test");
    });

    it("reads and writes profile", async () => {
      const profile: Profile = {
        version: 1,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        preferences: { colorScheme: "dark", density: "comfortable", motion: "reduced", language: "en", tokens: {} },
        patterns: [],
      };
      await storage.writeProfile(profile);
      const read = await storage.readProfile();
      expect(read?.preferences.colorScheme).toBe("dark");
    });

    it("reads and writes interview state", async () => {
      const state: InterviewState = {
        version: 1,
        status: "in_progress",
        currentTopic: "layout",
        currentQuestionIndex: 1,
        meter: 50,
        requiredTopics: ["layout"],
        answeredTopics: [],
        delegated: false,
        briefId: null,
        updatedAt: "2026-11-02T22:38:00.000Z",
      };
      await storage.writeInterviewState(state);
      const read = await storage.readInterviewState();
      expect(read?.meter).toBe(50);
    });

    it("reads and writes brief", async () => {
      const brief: Brief = {
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        version: 1,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        title: "Brief",
        summary: "Test",
        goals: [],
        constraints: [],
        designDirection: { palette: [] },
        technicalRequirements: [],
        outOfScope: [],
        approvalStatus: "draft",
        approvedAt: null,
        approvedBy: null,
      };
      await storage.writeBrief(brief);
      const read = await storage.readBrief(brief.id);
      expect(read?.title).toBe("Brief");
    });

    it("reads and writes feedback", async () => {
      const feedback: Feedback[] = [{
        id: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b",
        sceneId: "scene-1",
        objectId: "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c",
        kind: "visual",
        message: "Test feedback",
        severity: "medium",
        status: "sent",
        createdAt: "2026-11-02T22:38:00.000Z",
        acknowledgedAt: null,
        appliedAt: null,
        patchId: null,
      }];
      await storage.writeFeedback("scene-1", feedback);
      const read = await storage.readFeedback("scene-1");
      expect(read.length).toBe(1);
    });

    it("lists scenes", async () => {
      await storage.writeScene("scene-a", { version: 1, revision: 0, createdAt: "2026-11-02T22:38:00.000Z", updatedAt: "2026-11-02T22:38:00.000Z", screens: {}, objects: {}, screenOrder: [], metadata: { name: "A", tags: [] } });
      await storage.writeScene("scene-b", { version: 1, revision: 0, createdAt: "2026-11-02T22:38:00.000Z", updatedAt: "2026-11-02T22:38:00.000Z", screens: {}, objects: {}, screenOrder: [], metadata: { name: "B", tags: [] } });
      const list = await storage.listScenes();
      expect(list).toContain("scene-a");
      expect(list).toContain("scene-b");
    });
  });

  describe("LockPort", () => {
    it("acquires and releases lock", async () => {
      const objectId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const acquired = await lockPort.acquire("scene-1", objectId);
      expect(acquired).toBe(true);

      const isLocked = await lockPort.isLocked("scene-1", objectId);
      expect(isLocked).toBe(true);

      const released = await lockPort.release("scene-1", objectId);
      expect(released).toBe(true);

      const afterRelease = await lockPort.isLocked("scene-1", objectId);
      expect(afterRelease).toBe(false);
    });

    it("rejects acquire when already locked", async () => {
      const objectId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      await lockPort.acquire("scene-1", objectId);
      const acquired = await lockPort.acquire("scene-1", objectId);
      expect(acquired).toBe(false);
    });

    it("gets all locked objects", async () => {
      const objectId1 = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const objectId2 = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      await lockPort.acquire("scene-1", objectId1);
      await lockPort.acquire("scene-1", objectId2);
      const locks = await lockPort.getLockedObjects("scene-1");
      expect(locks.length).toBe(2);
      expect(locks).toContain(objectId1);
      expect(locks).toContain(objectId2);
    });
  });

  describe("CryptoPort", () => {
    it("generates UUID v7", () => {
      const crypto = createCryptoPort();
      const id = crypto.generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("hashes and verifies", async () => {
      const crypto = createCryptoPort();
      const hash = await crypto.hash("test input");
      expect(hash).toHaveLength(64);
      const verified = await crypto.verify("test input", hash);
      expect(verified).toBe(true);
      const wrong = await crypto.verify("wrong", hash);
      expect(wrong).toBe(false);
    });
  });

  describe("normalizeScene", () => {
    it("returns scene and empty patches", () => {
      const scene: Scene = {
        version: 1,
        revision: 0,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        screens: {},
        objects: {},
        screenOrder: [],
        metadata: { name: "Test", tags: [] },
      };
      const result = normalizeScene(scene);
      expect(result.scene).toEqual(scene);
      expect(result.patches).toEqual([]);
    });
  });

  describe("applyPatch", () => {
    it("applies set patch", () => {
      const sceneId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const objectId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const patchId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      
      const scene: Scene = {
        version: 1,
        revision: 0,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        screens: {},
        objects: {
          [objectId]: {
            id: objectId,
            type: "text",
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
      const patch: Patch = {
        id: patchId,
        sceneId,
        baseRevision: 0,
        objectId,
        op: "set",
        path: "props.content",
        value: "World",
        createdAt: "2026-11-02T22:38:00.000Z",
        status: "pending",
      };
      const result = applyPatch(scene, patch);
      expect(result.revision).toBe(1);
      expect(result.objects[objectId].props.content).toBe("World");
    });

    it("applies unset patch", () => {
      const sceneId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const objectId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const patchId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      
      const scene: Scene = {
        version: 1,
        revision: 0,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        screens: {},
        objects: {
          [objectId]: {
            id: objectId,
            type: "text",
            parentId: null,
            children: [],
            props: { content: "Hello", fontSize: 16 },
            style: {},
            meta: {},
          },
        },
        screenOrder: [],
        metadata: { name: "Test", tags: [] },
      };
      const patch: Patch = {
        id: patchId,
        sceneId,
        baseRevision: 0,
        objectId,
        op: "unset",
        path: "props.fontSize",
        createdAt: "2026-11-02T22:38:00.000Z",
        status: "pending",
      };
      const result = applyPatch(scene, patch);
      expect("fontSize" in result.objects[objectId].props).toBe(false);
    });

    it("throws on missing object", () => {
      const sceneId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const missingObjectId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d";
      const patchId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      
      const scene: Scene = {
        version: 1,
        revision: 0,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        screens: {},
        objects: {},
        screenOrder: [],
        metadata: { name: "Test", tags: [] },
      };
      const patch: Patch = {
        id: patchId,
        sceneId,
        baseRevision: 0,
        objectId: missingObjectId,
        op: "set",
        path: "props.content",
        value: "Test",
        createdAt: "2026-11-02T22:38:00.000Z",
        status: "pending",
      };
      expect(() => applyPatch(scene, patch)).toThrow(IntentError);
    });
  });

  describe("writePipeline", () => {
    it("applies patches successfully", async () => {
      const sceneId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const objectId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const patchId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      
      const scene: Scene = {
        version: 1,
        revision: 0,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        screens: {},
        objects: {
          [objectId]: {
            id: objectId,
            type: "text",
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
      await storage.writeScene(sceneId, scene);

      const patch: Patch = {
        id: patchId,
        sceneId,
        baseRevision: 0,
        objectId,
        op: "set",
        path: "props.content",
        value: "World",
        createdAt: "2026-11-02T22:38:00.000Z",
        status: "pending",
      };
      const result = await writePipeline(storage, lockPort, sceneId, [patch]);
      expect(result.success).toBe(true);
      expect(result.revision).toBe(1);
    });

    it("returns conflict on revision mismatch", async () => {
      const sceneId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const objectId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const patchId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      
      const scene: Scene = {
        version: 1,
        revision: 0,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        screens: {},
        objects: {},
        screenOrder: [],
        metadata: { name: "Test", tags: [] },
      };
      await storage.writeScene(sceneId, scene);

      const patch: Patch = {
        id: patchId,
        sceneId,
        baseRevision: 5,
        objectId,
        op: "set",
        path: "props.content",
        value: "World",
        createdAt: "2026-11-02T22:38:00.000Z",
        status: "pending",
      };
      const result = await writePipeline(storage, lockPort, sceneId, [patch]);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ErrorCodes.E_CONFLICT);
    });

    it("returns locked when object locked by another", async () => {
      const sceneId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a";
      const objectId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b";
      const patchId = "018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c";
      
      const scene: Scene = {
        version: 1,
        revision: 0,
        createdAt: "2026-11-02T22:38:00.000Z",
        updatedAt: "2026-11-02T22:38:00.000Z",
        screens: {},
        objects: {
          [objectId]: {
            id: objectId,
            type: "text",
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
      await storage.writeScene(sceneId, scene);

      await lockPort.acquire(sceneId, objectId);

      const patch: Patch = {
        id: patchId,
        sceneId,
        baseRevision: 0,
        objectId,
        op: "set",
        path: "props.content",
        value: "World",
        createdAt: "2026-11-02T22:38:00.000Z",
        status: "pending",
      };
      const result = await writePipeline(storage, lockPort, sceneId, [patch]);
      expect(result.success).toBe(false);
      expect(result.error).toBe(ErrorCodes.E_LOCKED);
    });
  });

  describe("Error handling", () => {
    it("creates IntentError with code", () => {
      const err = new IntentError(ErrorCodes.E_NOT_FOUND, "Not found");
      expect(err.code).toBe(ErrorCodes.E_NOT_FOUND);
      expect(err.message).toBe("Not found");
    });

    it("isIntentError identifies IntentError", () => {
      expect(isIntentError(new IntentError(ErrorCodes.E_NOT_FOUND, ""))).toBe(true);
      expect(isIntentError(new Error("regular"))).toBe(false);
      expect(isIntentError(null)).toBe(false);
    });
  });
});