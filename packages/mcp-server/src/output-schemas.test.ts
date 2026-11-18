import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createMCPContext, handleMCPRequest } from "./index";

// trd 14.3 / review-2026-11-16 flag: the three tools with output schemas in
// @intent/schema are enforced at the MCP boundary. These tests pin the
// agent-facing contract — in particular that the payloads keep the newer
// metadata (trd 17.1 profile summary) and pendingPatches fields, and that a
// stale-baseRevision apply_patch does not trip the validator.

const SCENE_ID = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT_ID = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

const SCENE = {
  version: 1 as const,
  revision: 1,
  createdAt: "2026-11-18T00:00:00.000Z",
  updatedAt: "2026-11-18T00:00:00.000Z",
  screens: {},
  objects: {
    [OBJECT_ID]: {
      id: OBJECT_ID,
      type: "text" as const,
      parentId: null,
      children: [],
      props: { content: "Hello" },
      style: {},
      meta: {},
    },
  },
  screenOrder: [],
  metadata: { name: "OutputSchemaTest", tags: [] },
};

const SENT_FEEDBACK = [
  {
    id: "p_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    sceneId: SCENE_ID,
    objectId: OBJECT_ID,
    kind: "visual",
    message: "Make the text larger",
    severity: "medium",
    status: "sent",
    chips: [],
    baseRevision: 1,
    createdAt: "2026-11-18T00:00:00.000Z",
    sentAt: "2026-11-18T00:00:00.000Z",
    appliedAt: null,
    patchId: null,
    annotationIds: [],
  },
];

let testDir: string;
let context: ReturnType<typeof createMCPContext>;

beforeEach(async () => {
  testDir = resolve(os.tmpdir(), `.test-output-schemas-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(testDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(testDir, ".intent", "scenes", `${SCENE_ID}.json`), JSON.stringify(SCENE), "utf-8");
  await fs.mkdir(resolve(testDir, ".intent", "feedback"), { recursive: true });
  await fs.writeFile(resolve(testDir, ".intent", "feedback", `${SCENE_ID}.json`), JSON.stringify(SENT_FEEDBACK), "utf-8");
  context = createMCPContext(testDir);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

describe("MCP output schema enforcement (trd 14.3)", () => {
  it("get_scene keeps metadata.profileSummary and pendingPatches (no silent stripping)", async () => {
    const result = (await handleMCPRequest("get_scene", { sceneId: SCENE_ID }, context)) as Record<string, unknown>;
    expect(typeof result["revision"]).toBe("number");
    expect(result["metadata"]).toEqual({ profileSummary: expect.any(String) });
    expect(result["pendingPatches"]).toBeUndefined(); // full path: summary carries it
    expect(result["summary"]).toMatchObject({ pendingPatches: 1 });
    expect(Array.isArray(result["locks"])).toBe(true);
  });

  it("get_scene with objectIds keeps the subset shape", async () => {
    const result = (await handleMCPRequest("get_scene", { sceneId: SCENE_ID, objectIds: [OBJECT_ID] }, context)) as Record<string, unknown>;
    expect(Object.keys(result["objects"] as Record<string, unknown>)).toContain(OBJECT_ID);
    expect(typeof result["pendingPatches"]).toBe("number");
    expect(result["metadata"]).toEqual({ profileSummary: expect.any(String) });
  });

  it("get_feedback returns the sent item and keeps the contract keys", async () => {
    const result = (await handleMCPRequest("get_feedback", { sceneId: SCENE_ID }, context)) as Record<string, unknown>;
    expect(Array.isArray(result["feedback"])).toBe(true);
    expect((result["feedback"] as { message: string }[])[0]?.message).toBe("Make the text larger");
    expect(Object.keys(result).sort()).toEqual(["annotations", "feedback", "interviewAnswers", "locked"]);
  });

  it("apply_patch with a stale baseRevision returns E_CONFLICT without tripping the validator", async () => {
    const patch = {
      id: "p_02ARZ3NDEKTSV4RRFFQ69G5FAV",
      sceneId: SCENE_ID,
      baseRevision: 99,
      objectId: OBJECT_ID,
      op: "set",
      path: "props.content",
      value: "Nope",
      createdAt: "2026-11-18T00:00:00.000Z",
      status: "sent",
    };
    const result = (await handleMCPRequest("apply_patch", { patch }, context)) as Record<string, unknown>;
    expect(result["success"]).toBe(false);
    expect(result["error"]).toBe("E_CONFLICT");
    expect(typeof result["revision"]).toBe("number");
  });
});
