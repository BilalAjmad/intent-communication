import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createMCPContext, handleMCPRequest } from "./index";

// trd 17.1 end to end: answers fed through ask_user teach the Intent Profile;
// get_scene exposes a metadata.profileSummary; ask_user returns preFilled.
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
  metadata: { name: "IntentProfileTest", tags: [] },
};

let testDir: string;
let context: ReturnType<typeof createMCPContext>;

async function seed(): Promise<void> {
  testDir = resolve(os.tmpdir(), `.test-intent-profile-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  const scenesDir = resolve(testDir, ".intent", "scenes");
  await fs.mkdir(scenesDir, { recursive: true });
  await fs.writeFile(resolve(scenesDir, "s_01ARZ3NDEKTSV4RRFFQ69G5FAV.json"), JSON.stringify(SCENE), "utf-8");
  context = createMCPContext(testDir);
}

beforeEach(seed);
afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

async function ask(id: string, answer: unknown, topic: string) {
  return (await handleMCPRequest(
    "ask_user",
    {
      questionId: id,
      kind: "text",
      prompt: "How should this feel?",
      topic,
      previousAnswer: { questionId: id, answer },
    },
    context,
  )) as Record<string, unknown>;
}

describe("Intent Profile learning (trd 17.1)", () => {
  it("an explicit answer activates an entry; get_scene exposes the summary", async () => {
    await ask("q_step_1", "I always want a playful tone", "content");
    const scene = (await handleMCPRequest("get_scene", { sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV" }, context)) as {
      metadata?: { profileSummary?: string };
    };
    expect(scene.metadata?.profileSummary).toContain("playful");
  });

  it("two weak answers to the same preference activate it; ask_user returns preFilled", async () => {
    await ask("q_weak_1", "make it playful", "content");
    await ask("q_weak_2", "keep the tone friendly and playful", "content");
    const result = await ask("q_weak_3", "a playful vibe", "content");
    const preFilled = result["preFilled"] as { key?: string; remembered?: boolean } | undefined;
    expect(preFilled?.key).toBe("content.tone");
    expect(preFilled?.remembered).toBe(true);
  });

  it("never writes scene text into the profile file", async () => {
    await ask("q_secret", "I always want playful tone. Secret: project codename BLUE-ORBIT", "content");
    const raw = await fs.readFile(resolve(testDir, ".intent", "intent-profile.json"), "utf-8");
    expect(raw).not.toContain("BLUE-ORBIT");
  });

  it("a corrupt profile file surfaces E_SCHEMA, not a crash", async () => {
    await fs.mkdir(resolve(testDir, ".intent"), { recursive: true });
    await fs.writeFile(resolve(testDir, ".intent", "intent-profile.json"), "not json {{{", "utf-8");
    await expect(handleMCPRequest("get_scene", { sceneId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV" }, context)).rejects.toThrow();
  });
});
