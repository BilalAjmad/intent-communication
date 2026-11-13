import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createStoragePort, createLockPort } from "./ports";
import { assertSafeId, MAX_ID_LENGTH } from "./paths";
import { ErrorCodes, isIntentError } from "./error";

// Identifiers used here become filesystem path segments, so an unchecked
// value turns a client error into an opaque ENOENT/ENAMETOOLONG. These
// tests pin the E_BAD_REQUEST contract (Review Focus #3 and #4).

describe("Identifier safety", () => {
  it("accepts a normal id", () => {
    expect(() => assertSafeId("s_01ARZ3NDEKTSV4RRFFQ69G5FAV", "sceneId")).not.toThrow();
  });

  it("rejects an empty id", () => {
    expect(() => assertSafeId("", "sceneId")).toThrow();
  });

  it("rejects a path traversal id", () => {
    try {
      assertSafeId("../../etc/passwd", "sceneId");
      throw new Error("should have thrown");
    } catch (err) {
      expect(isIntentError(err)).toBe(true);
      expect((err as { code: string }).code).toBe(ErrorCodes.E_BAD_REQUEST);
    }
  });

  it("rejects an id containing a forward slash", () => {
    expect(() => assertSafeId("a/b", "sceneId")).toThrow();
  });

  it("rejects an id containing a backslash", () => {
    expect(() => assertSafeId("a\\b", "sceneId")).toThrow();
  });

  it("rejects an id containing a NUL byte", () => {
    expect(() => assertSafeId("a\0b", "sceneId")).toThrow();
  });

  it("rejects an id longer than the maximum", () => {
    const tooLong = "s_" + "a".repeat(MAX_ID_LENGTH);
    try {
      assertSafeId(tooLong, "sceneId");
      throw new Error("should have thrown");
    } catch (err) {
      expect(isIntentError(err)).toBe(true);
      expect((err as { code: string }).code).toBe(ErrorCodes.E_BAD_REQUEST);
    }
  });
});

describe("StoragePort identifier safety", () => {
  let testDir: string;
  let storage: ReturnType<typeof createStoragePort>;
  let lockPort: ReturnType<typeof createLockPort>;

  beforeEach(async () => {
    testDir = resolve(os.tmpdir(), `.test-intent-paths-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    storage = createStoragePort(testDir);
    lockPort = createLockPort(storage);
  });

  it("rejects a traversal scene id on read", async () => {
    await expect(storage.readScene("../../etc/passwd")).rejects.toThrow();
  });

  it("rejects a traversal scene id on write", async () => {
    const scene = {
      version: 1,
      revision: 0,
      createdAt: "2026-11-13T00:00:00.000Z",
      updatedAt: "2026-11-13T00:00:00.000Z",
      screens: {},
      objects: {},
      screenOrder: [],
      metadata: { name: "Test", tags: [] },
    };
    await expect(storage.writeScene("../escape", scene)).rejects.toThrow();
  });

  it("rejects an over-long scene id instead of failing at the filesystem", async () => {
    const tooLong = "s_" + "a".repeat(500);
    await expect(storage.readScene(tooLong)).rejects.toThrow();
  });

  it("rejects an over-long object id on lock acquire", async () => {
    const tooLong = "o_" + "a".repeat(500);
    await expect(lockPort.acquire("scene-1", tooLong)).rejects.toThrow();
  });

  it("rejects a traversal object id on lock acquire", async () => {
    await expect(lockPort.acquire("scene-1", "../../escape")).rejects.toThrow();
  });

  it("writes lock entries under the storage root, not the process cwd", async () => {
    await lockPort.acquire("scene-1", "o_01ARZ3NDEKTSV4RRFFQ69G5FAV");
    const lockFile = resolve(testDir, ".intent", "locks", "scene-1.locks.json");
    await expect(fs.access(lockFile)).resolves.toBeUndefined();
  });
});
