import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// Axe on the Interview tab — no critical/serious violations.
// bypassCSP because the shell's CSP correctly blocks injected inline scripts.

test.use({ bypassCSP: true });

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

const scene = {
  version: 1,
  revision: 1,
  createdAt: "2026-11-13T00:00:00.000Z",
  updatedAt: "2026-11-13T00:00:00.000Z",
  screens: {
    [SCREEN]: {
      id: SCREEN,
      type: "screen",
      parentId: null,
      children: [TEXT],
      props: { title: "Axe Interview", width: 390, height: 844 },
      style: {},
      meta: {},
    },
  },
  objects: {
    [TEXT]: { id: TEXT, type: "text", parentId: SCREEN, children: [], props: { content: "Hello" }, style: {}, meta: {} },
  },
  screenOrder: [SCREEN],
  metadata: { name: "Axe Interview", tags: [] },
};

const interviewState = {
  version: 1,
  status: "in_progress",
  currentQuestionIndex: 2,
  meter: 62,
  meterTopics: { goal: "covered", users: "partial" },
  requiredTopics: ["goal", "users"],
  answeredTopics: ["goal"],
  delegated: false,
  delegatedAt: null,
  briefId: null,
  updatedAt: new Date().toISOString(),
  pendingQuestion: {
    questionId: "q-axe-1",
    kind: "choice",
    prompt: "Which look fits best?",
    options: [
      { value: "minimal", label: "Minimal and calm" },
      { value: "bold", label: "Bold and colorful" },
    ],
    topic: "style",
    round: "Style",
    questionNumber: 3,
    estimatedTotal: 15,
    whyAsked: "The style directs every later visual decision.",
    askedAt: new Date().toISOString(),
  },
  answers: [],
};

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

test.beforeAll(async () => {
  tmpDir = resolve(os.tmpdir(), `.test-axe-interview-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

test("axe: no critical or serious violations in the Interview tab", async ({ page }) => {
  const axePath = resolve(process.cwd(), "node_modules", "axe-core", "axe.min.js");
  const axeSource = await fs.readFile(axePath, "utf-8");
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Axe Interview", { timeout: 8000 });
  await page.click("#tab-interview");
  await expect(page.locator(".interview-question")).toBeVisible({ timeout: 5000 });

  await page.evaluate((source) => {
    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  }, axeSource);

  const violations = await page.evaluate(async () => {
    const results = await (window as unknown as { axe: { run: (ctx: Element, opts: object) => Promise<{ violations: Array<{ id: string; impact: string | null; help: string }> }> } }).axe.run(document.body, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    return results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help }));
  });

  const criticalOrSerious = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  if (criticalOrSerious.length > 0) {
    console.log("Critical/serious violations:", JSON.stringify(criticalOrSerious, null, 2));
  }
  expect(criticalOrSerious).toEqual([]);
});
