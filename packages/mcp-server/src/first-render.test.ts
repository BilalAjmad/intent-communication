import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createMCPContext, handleMCPRequest } from "./index";

// trd 17.2: the first successful apply_patch writes a first-render marker
// (baseline for the acceptance-rate metric). It is written once, never twice.
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
  metadata: { name: "FirstRenderTest", tags: [] },
};

let testDir: string;
let context: ReturnType<typeof createMCPContext>;

const patchFor = (id: string, baseRevision: number, content: string) => ({
  id,
  sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  baseRevision,
  objectId: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  op: "set",
  path: "props.content",
  value: content,
  createdAt: "2026-11-16T00:00:00.000Z",
  status: "sent" as const,
});

beforeEach(async () => {
  testDir = resolve(os.tmpdir(), `.test-first-render-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  const scenesDir = resolve(testDir, ".intent", "scenes");
  await fs.mkdir(scenesDir, { recursive: true });
  await fs.writeFile(resolve(scenesDir, "s_01ARZ3NDEKTSV4RRFFQ69G5FAV.json"), JSON.stringify(SCENE), "utf-8");
  context = createMCPContext(testDir);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

describe("first-render baseline marker (trd 17.2)", () => {
  it("is written exactly once, on the first successful apply_patch", async () => {
    const first = (await handleMCPRequest(
      "apply_patch",
      { patch: patchFor("p_01ARZ3NDEKTSV4RRFFQ69G5FAV", 1, "Updated") },
      context,
    )) as Record<string, unknown>;
    expect(first.success).toBe(true);

    const dir = resolve(testDir, ".intent", "versions");
    const afterFirst = await fs.readdir(dir);
    // New-style markers embed the sceneId for cross-scene metric isolation.
    const markers = afterFirst.filter((name) => /Z-r\d+(-[A-Za-z0-9_-]{1,120})?-first-render\.json$/.test(name));
    expect(markers).toHaveLength(1);
    expect(markers[0]).toContain("s_01ARZ3NDEKTSV4RRFFQ69G5FAV");
    // Baseline snapshot must carry the scene as of that first write (revision 2 after the patch).
    const baseline = JSON.parse(await fs.readFile(resolve(dir, markers[0] as string), "utf-8")) as { revision: number };
    expect(baseline.revision).toBe(2);

    const second = (await handleMCPRequest(
      "apply_patch",
      { patch: patchFor("p_02ARZ3NDEKTSV4RRFFQ69G5FAV", 2, "Again") },
      context,
    )) as Record<string, unknown>;
    expect(second.success).toBe(true);
    const afterSecond = await fs.readdir(dir);
    expect(afterSecond.filter((name) => /Z-r\d+(-[A-Za-z0-9_-]{1,120})?-first-render\.json$/.test(name))).toHaveLength(1);
  });

  it("is not written when the patch fails (E_CONFLICT)", async () => {
    const conflict = (await handleMCPRequest(
      "apply_patch",
      { patch: patchFor("p_03ARZ3NDEKTSV4RRFFQ69G5FAV", 999, "Nope") },
      context,
    )) as Record<string, unknown>;
    expect(conflict.success).toBe(false);
    const dir = resolve(testDir, ".intent", "versions");
    const markers = await fs.readdir(dir).catch(() => [] as string[]);
    expect(markers.filter((name) => /Z-r\d+(-[A-Za-z0-9_-]{1,120})?-first-render\.json$/.test(name))).toHaveLength(0);
  });
});
