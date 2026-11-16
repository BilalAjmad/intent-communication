import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createMCPContext, handleMCPRequest } from "./index";
import type { Annotation } from "@intent/schema";

// trd 9.7 / 10.4: get_feedback surfaces sent/resolved annotations only;
// includeImageData attaches base64 bytes for the first 3 images per call.

const SCENE_ID = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OPEN_ID = "a_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const SENT_ID = "a_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const IMG_ID = "a_03ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT_ID = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

const SCENE = {
  version: 1,
  revision: 1,
  createdAt: "2026-11-13T00:00:00.000Z",
  updatedAt: "2026-11-13T00:00:00.000Z",
  screens: {},
  objects: {
    [OBJECT_ID]: {
      id: OBJECT_ID, type: "text", parentId: null, children: [],
      props: { content: "Hello" }, style: {}, meta: {},
    },
  },
  screenOrder: [],
  metadata: { name: "Test", tags: [] },
};

function mkAnnotation(id: string, status: "open" | "sent" | "resolved", withImage = false): Annotation {
  const base: Annotation = {
    schemaVersion: 1,
    id,
    kind: "pencil",
    objectId: OBJECT_ID,
    screenId: "s_02ARZ3NDEKTSV4RRFFQ69G5FAV",
    anchor: { x: 10, y: 20 },
    strokes: [
      { color: "red", width: 4, points: [[0, 0], [10, 10], [20, 5]] },
    ],
    text: "make it bigger",
    status,
    createdAt: "2026-11-16T00:00:00.000Z",
  };
  if (withImage) {
    base.image = { file: `${id}.png`, width: 1, height: 1, bytes: 45 };
  }
  return base;
}

function makePng(width = 1, height = 1): Buffer {
  const buf = Buffer.alloc(45, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

let testDir: string;
let context: ReturnType<typeof createMCPContext>;

beforeAll(async () => {
  testDir = resolve(os.tmpdir(), `.test-mcp-annotations-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  const scenesDir = resolve(testDir, ".intent", "scenes");
  await fs.mkdir(scenesDir, { recursive: true });
  await fs.writeFile(resolve(scenesDir, `${SCENE_ID}.json`), JSON.stringify(SCENE), "utf-8");
  context = createMCPContext(testDir);
});

afterAll(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

beforeEach(async () => {
  await context.storage.writeAnnotations(SCENE_ID, []);
});

describe("get_feedback: annotations (trd 9.7)", () => {
  it("returns empty annotations for a fresh scene", async () => {
    const result = (await handleMCPRequest("get_feedback", { sceneId: SCENE_ID }, context)) as Record<string, unknown>;
    expect(result.annotations).toEqual([]);
  });

  it("returns sent annotations but never open drafts", async () => {
    await context.storage.writeAnnotations(SCENE_ID, [
      mkAnnotation(OPEN_ID, "open"),
      mkAnnotation(SENT_ID, "sent"),
    ]);
    const result = (await handleMCPRequest("get_feedback", { sceneId: SCENE_ID }, context)) as Record<string, unknown>;
    const ids = (result.annotations as { id: string }[]).map((a) => a.id);
    expect(ids).toEqual([SENT_ID]);
    expect(ids).not.toContain(OPEN_ID);
  });

  it("omits imageData by default and attaches base64 bytes when asked", async () => {
    await context.storage.writeAnnotations(SCENE_ID, [mkAnnotation(IMG_ID, "sent", true)]);
    await context.storage.writeAnnotationImage(SCENE_ID, IMG_ID, makePng());

    const without = (await handleMCPRequest("get_feedback", { sceneId: SCENE_ID }, context)) as Record<string, unknown>;
    const first = (without.annotations as Record<string, unknown>[])[0];
    expect(first.image).toBeDefined();
    expect(first.imageData).toBeUndefined();

    const withData = (await handleMCPRequest(
      "get_feedback",
      { sceneId: SCENE_ID, includeImageData: true },
      context,
    )) as Record<string, unknown>;
    const second = (withData.annotations as Record<string, unknown>[])[0];
    expect(typeof second.imageData).toBe("string");
    expect(Buffer.from(second.imageData as string, "base64").equals(makePng())).toBe(true);
  });

  it("caps imageData at 3 images per call", async () => {
    const ids = [
      "a_04ARZ3NDEKTSV4RRFFQ69G5FAV",
      "a_05ARZ3NDEKTSV4RRFFQ69G5FAV",
      "a_06ARZ3NDEKTSV4RRFFQ69G5FAV",
      "a_07ARZ3NDEKTSV4RRFFQ69G5FAV",
    ];
    await context.storage.writeAnnotations(
      SCENE_ID,
      ids.map((id) => mkAnnotation(id, "sent", true)),
    );
    for (const id of ids) {
      await context.storage.writeAnnotationImage(SCENE_ID, id, makePng());
    }
    const result = (await handleMCPRequest(
      "get_feedback",
      { sceneId: SCENE_ID, includeImageData: true },
      context,
    )) as Record<string, unknown>;
    const withData = (result.annotations as Record<string, unknown>[]).filter((a) => a.imageData);
    expect(withData).toHaveLength(3);
  });

  it("filters annotations by objectIds when asked", async () => {
    const other = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
    await context.storage.writeAnnotations(SCENE_ID, [
      mkAnnotation(SENT_ID, "sent"),
      { ...mkAnnotation(OPEN_ID, "sent"), objectId: other },
    ]);
    const result = (await handleMCPRequest(
      "get_feedback",
      { sceneId: SCENE_ID, objectIds: [OBJECT_ID] },
      context,
    )) as Record<string, unknown>;
    const ids = (result.annotations as { id: string }[]).map((a) => a.id);
    expect(ids).toEqual([SENT_ID]);
  });
});
