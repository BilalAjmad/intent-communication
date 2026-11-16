import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createFileStoragePort } from "./index";
import type { Annotation } from "@intent/schema";

const testDir = tmpdir() + "/.test-annotations-port";
const SCENE_ID = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const ANN_ID = "a_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT_ID = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function mkAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    schemaVersion: 1,
    id: ANN_ID,
    kind: "pencil",
    objectId: OBJECT_ID,
    screenId: SCENE_ID,
    anchor: { x: 5, y: 6 },
    strokes: [{ color: "black", width: 2, points: [[0, 0], [7, 9]] }],
    status: "open",
    createdAt: "2026-11-16T00:00:00.000Z",
    ...overrides,
  };
}

function makePng(width = 1, height = 1): Buffer {
  const buf = Buffer.alloc(45, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

let storage: ReturnType<typeof createFileStoragePort>;

beforeEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(testDir, { recursive: true });
  storage = createFileStoragePort(testDir);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

describe("readAnnotations / writeAnnotations", () => {
  it("returns [] when no file exists", async () => {
    expect(await storage.readAnnotations(SCENE_ID)).toEqual([]);
  });

  it("round-trips annotations with validation", async () => {
    await storage.writeAnnotations(SCENE_ID, [mkAnnotation()]);
    const read = await storage.readAnnotations(SCENE_ID);
    expect(read).toHaveLength(1);
    expect(read[0]?.id).toBe(ANN_ID);
    expect(read[0]?.kind).toBe("pencil");
  });

  it("rejects an oversized annotations file", async () => {
    const annotationsDir = resolve(testDir, ".intent", "annotations");
    await fs.mkdir(annotationsDir, { recursive: true });
    // A 1 MB+1 file of valid JSON array shape.
    const big = JSON.stringify(["x".repeat(1_000_000)]);
    await fs.writeFile(resolve(annotationsDir, `${SCENE_ID}.json`), big, "utf-8");
    await expect(storage.readAnnotations(SCENE_ID)).rejects.toThrow();
  });

  it("rejects an entry that fails schema validation", async () => {
    const annotationsDir = resolve(testDir, ".intent", "annotations");
    await fs.mkdir(annotationsDir, { recursive: true });
    const corrupt = [{ ...mkAnnotation(), strokes: [{ color: "purple", width: 4, points: [[0, 0], [1, 1]] }] }];
    await fs.writeFile(resolve(annotationsDir, `${SCENE_ID}.json`), JSON.stringify(corrupt), "utf-8");
    await expect(storage.readAnnotations(SCENE_ID)).rejects.toThrow();
  });

  it("rejects a payload over 1 MB on write", async () => {
    const huge = mkAnnotation({ text: "x".repeat(1_000_000) });
    await expect(storage.writeAnnotations(SCENE_ID, [huge])).rejects.toThrow();
  });
});

describe("writeAnnotationImage / readAnnotationImage", () => {
  it("writes a valid PNG, parses IHDR, reads it back", async () => {
    const png = makePng(7, 5);
    const written = await storage.writeAnnotationImage(SCENE_ID, ANN_ID, png);
    expect(written).toEqual({ file: `${ANN_ID}.png`, width: 7, height: 5 });
    const read = await storage.readAnnotationImage(SCENE_ID, written.file);
    expect(read?.equals(png)).toBe(true);
  });

  it("rejects non-PNG bytes", async () => {
    await expect(
      storage.writeAnnotationImage(SCENE_ID, ANN_ID, Buffer.from("definitely not a png file, no")),
    ).rejects.toThrow();
  });

  it("rejects a PNG over 1 MB", async () => {
    const big = Buffer.concat([makePng(), Buffer.alloc(1_000_001, 0)]);
    await expect(storage.writeAnnotationImage(SCENE_ID, ANN_ID, big)).rejects.toThrow();
  });

  it("rejects invalid annotation ids and bad image file names", async () => {
    await expect(storage.writeAnnotationImage(SCENE_ID, "p_01ARZ3NDEKTSV4RRFFQ69G5FAV", makePng())).rejects.toThrow();
    await expect(storage.readAnnotationImage(SCENE_ID, "../evil.png")).rejects.toThrow();
    await expect(storage.readAnnotationImage(SCENE_ID, "a_01ARZ3NDEKTSV4RRFFQ69G5FAV.png/..")).rejects.toThrow();
    expect(await storage.readAnnotationImage(SCENE_ID, "a_99ARZ3NDEKTSV4RRFFQ69G5FAV.png")).toBeNull();
  });

  it("rejects out-of-range PNG dimensions", async () => {
    const png = makePng(5000, 10);
    await expect(storage.writeAnnotationImage(SCENE_ID, ANN_ID, png)).rejects.toThrow();
  });
});
