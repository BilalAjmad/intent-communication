import { describe, it, expect, beforeEach } from "vitest";
import {
  createFileStoragePort,
  createFileLockPort,
  createNodeCryptoPort,
  IntentError,
  ErrorCodes,
  isIntentError,
} from "./index";
import { Scene, Lock, LocksFile, Config, Profile, InterviewState, Brief, Feedback } from "@intent/schema";

describe("Adapters-Node package", () => {
  const testDir = require("os").tmpdir() + "/.test-intent-adapters";
  let storage: ReturnType<typeof createFileStoragePort>;
  let lockPort: ReturnType<typeof createFileLockPort>;
  let crypto: ReturnType<typeof createNodeCryptoPort>;

  beforeEach(async () => {
    storage = createFileStoragePort(testDir);
    lockPort = createFileLockPort(storage);
    crypto = createNodeCryptoPort();
  });

  describe("FileStoragePort", () => {
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

  describe("FileLockPort", () => {
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

  describe("NodeCryptoPort", () => {
    it("generates UUID v7", () => {
      const id = crypto.generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("hashes and verifies", async () => {
      const hash = await crypto.hash("test input");
      expect(hash).toHaveLength(64);
      const verified = await crypto.verify("test input", hash);
      expect(verified).toBe(true);
      const wrong = await crypto.verify("wrong", hash);
      expect(wrong).toBe(false);
    });
  });

  describe("Path traversal protection", () => {
    it("rejects path traversal in scene ID", async () => {
      await expect(storage.readScene("../etc/passwd")).rejects.toThrow();
    });

    it("rejects path traversal in writeScene", async () => {
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
      await expect(storage.writeScene("../etc/passwd", scene)).rejects.toThrow();
    });
  });
});