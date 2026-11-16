import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// The Interview tab summary screen — "Change something" path (design 2.3/3.1):
// turn the items editable, edit, save, and the answer lands in state.json
// through /api/interview/answer with summaryChoice "change" and the edited items.

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

const scene = {
  version: 1,
  revision: 1,
  createdAt: "2026-11-15T00:00:00.000Z",
  updatedAt: "2026-11-15T00:00:00.000Z",
  screens: {
    [SCREEN]: {
      id: SCREEN,
      type: "screen",
      parentId: null,
      children: [TEXT],
      props: { title: "Summary", width: 390, height: 844 },
      style: {},
      meta: {},
    },
  },
  objects: {
    [TEXT]: { id: TEXT, type: "text", parentId: SCREEN, children: [], props: { content: "Hello" }, style: {}, meta: {} },
  },
  screenOrder: [SCREEN],
  metadata: { name: "Summary", tags: [] },
};

const interviewState = {
  version: 1,
  status: "in_progress",
  currentQuestionIndex: 4,
  meter: 80,
  meterTopics: { goal: "covered", users: "covered" },
  requiredTopics: ["goal", "users"],
  answeredTopics: ["goal", "users"],
  delegated: true,
  delegatedAt: "2026-11-15T00:00:00.000Z",
  briefId: null,
  updatedAt: "2026-11-15T00:00:00.000Z",
  pendingQuestion: {
    questionId: "q-summary-1",
    kind: "summary",
    prompt: "Here is what I understood",
    summary: {
      paragraph: "A calm salon booking page for walk-in customers.",
      items: [
        { topic: "goal", text: "Get more bookings" },
        { topic: "users", text: "Walk-in salon customers" },
      ],
      delegated: [{ questionId: "q-style-1", topic: "style", text: "Minimal and calm" }],
    },
    askedAt: "2026-11-15T00:00:00.000Z",
  },
  answers: [] as unknown[],
};

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

test.beforeAll(async () => {
  tmpDir = resolve(os.tmpdir(), `.test-summary-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.mkdir(resolve(tmpDir, ".intent", "interview"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(scene), "utf-8");
  await fs.writeFile(resolve(tmpDir, ".intent", "interview", "state.json"), JSON.stringify(interviewState), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
});

test.afterAll(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Change something: items become editable, Save changes posts summaryChoice=change with the edited items", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Summary", { timeout: 8000 });
  await page.click("#tab-interview");

  // Summary screen renders: title, paragraph, [you said] x2, [chosen by me] x1
  await expect(page.locator(".summary-title")).toHaveText("Here is what I understood");
  await expect(page.locator(".summary-paragraph")).toContainText("walk-in");
  await expect(page.locator(".tag-user")).toHaveCount(2);
  await expect(page.locator(".tag-chosen")).toHaveCount(1);

  // Click "Change something" — the editable mode engages (only the text span of [you said] items)
  await page.getByRole("button", { name: "Change something" }).click();
  await expect(page.locator(".summary-item span:last-child").first()).toHaveAttribute("contenteditable", "true");
  // [chosen by me] items and the tag spans are NOT editable
  await expect(page.locator(".summary-delegated .summary-item span:last-child").first()).not.toHaveAttribute("contenteditable", "true");
  await expect(page.locator(".summary-item .tag").first()).not.toHaveAttribute("contenteditable", "true");
  const saveBtn = page.locator(".save-summary-changes");
  await expect(saveBtn).toBeVisible();

  // Edit the first [you said] item
  const firstItem = page.locator(".summary-item").first();
  await firstItem.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Get more bookings via Google");

  // Save
  await saveBtn.click();
  await expect(page.locator("#toast")).toContainText("Answer saved", { timeout: 5000 });

  // The answer reached .intent/interview/state.json via /api/interview/answer
  const raw = await fs.readFile(resolve(tmpDir, ".intent", "interview", "state.json"), "utf-8");
  const state = JSON.parse(raw) as {
    answers: Array<{
      questionId: string;
      via: string;
      answer: { kind: string; summaryChoice: string; changes?: string[] };
    }>;
    pendingQuestion: unknown;
  };
  const last = state.answers[state.answers.length - 1];
  expect(last.questionId).toBe("q-summary-1");
  expect(last.via).toBe("studio");
  expect(last.answer.summaryChoice).toBe("change");
  expect(Array.isArray(last.answer.changes)).toBe(true);
  expect(last.answer.changes?.some((c) => c.includes("Get more bookings via Google"))).toBe(true);
  // pendingQuestion is cleared (the question was answered)
  expect(state.pendingQuestion).toBeNull();
});
