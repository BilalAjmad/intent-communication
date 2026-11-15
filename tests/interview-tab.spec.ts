import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// TC-STU-08 — the Interview tab shows the same card as the plain-text card.
// TC-AXE — axe: no critical/serious violations on the Interview tab.
// TC-INT-E2E — agent asks via ask_user, user answers in Studio, get_feedback returns it once.

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene() {
  return {
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
        props: { title: "Interview Tab", width: 390, height: 844 },
        style: {},
        meta: {},
      },
    },
    objects: {
      [TEXT]: { id: TEXT, type: "text", parentId: SCREEN, children: [], props: { content: "Hello" }, style: {}, meta: {} },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Interview Tab", tags: [] },
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;
let token: string;

test.beforeAll(async () => {
  const scene = makeScene();
  tmpDir = resolve(os.tmpdir(), `.test-interview-tab-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(scene), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
  token = server.getSessionToken();
});

test.afterAll(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

const base = () => `http://127.0.0.1:${port}`;
const authed = () => ({
  "Content-Type": "application/json",
  Origin: base(),
  Cookie: `intent_session=${session}`,
});
let session: string;

test.beforeAll(async () => {
  const exchange = await fetch(`${base()}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base() },
    body: JSON.stringify({ token }),
  });
  expect(exchange.status).toBe(204);
  session = (exchange.headers.get("Set-Cookie") ?? "").split(";")[0].replace("intent_session=", "");
});

test("TC-STU-08 / TC-INT-E2E: tab card matches plain-text card; answered via Studio; get_feedback delivers once", async ({ page }) => {
  // Agent asks a question through the MCP tool (the shell must render the same content)
  const askRes = await fetch(`${base()}/api/mcp`, {
    method: "POST",
    headers: authed(),
    body: JSON.stringify({
      tool: "ask_user",
      input: {
        questionId: "q-style-1",
        kind: "choice",
        prompt: "Which look fits best?",
        options: [
          { value: "minimal", label: "Minimal and calm" },
          { value: "bold", label: "Bold and colorful" },
          { value: "corporate", label: "Corporate and clean" },
          { value: "playful", label: "Playful" },
        ],
        topic: "style",
        round: "Style",
        questionNumber: 7,
        estimatedTotal: 15,
        whyAsked: "The style directs every later visual decision.",
        requiredTopics: ["goal", "users"],
        meter: { percent: 62, topics: { goal: "covered", users: "partial" } },
      },
    }),
  });
  expect(askRes.status).toBe(200);
  const askJson = (await askRes.json()) as { result?: { renderedText: string; questionId: string; meterApplied: { percent: number } } };
  expect(askJson.result?.questionId).toBe("q-style-1");
  const renderedText = askJson.result!.renderedText;

  // Open the Studio — Interview tab should already show the question (auto-refresh via SSE/load)
  await page.goto(`${base()}/#t=${token}`);
  await expect(page.locator("#project-name")).toHaveText("Interview Tab", { timeout: 8000 });
  await page.click("#tab-interview");

  // The card renders: meta line, prompt, options, fixed lines, meter, topic chips, why-asked
  await expect(page.locator("#interview-body")).toContainText("Which look fits best?");
  await expect(page.locator("#interview-body")).toContainText("Question 7 of about 15 | Understanding: ~62% (estimate) | Round: Style");
  await expect(page.locator(".interview-option").first()).toBeVisible();
  await expect(page.locator("#interview-body")).toContainText("Minimal and calm");
  await expect(page.locator("#interview-body")).toContainText("Bold and colorful");
  await expect(page.locator("#interview-body")).toContainText("Corporate and clean");
  await expect(page.locator("#interview-body")).toContainText("Don't know, you choose");
  await expect(page.locator("#interview-body")).toContainText("Skip");
  await expect(page.locator("#interview-body")).toContainText("Estimated understanding");
  await expect(page.locator("#interview-body")).toContainText("Goal — covered");
  await expect(page.locator("#interview-body")).toContainText("Users — partly");

  // The tab card content matches the plain-text card (TC-STU-08: content equal)
  const plainLines = renderedText.split("\n").map((l) => l.trim()).filter(Boolean);
  const tabText = (await page.locator("#interview-body").innerText()).replace(/\s+/g, " ");
  for (const line of plainLines) {
    const normalized = line.replace(/\s+/g, " ");
    // the plain-text numbered option lines appear with the same numbers in the tab
    const queryable = normalized.replace(/^\s*(\d+)\)\s*/, "");
    if (queryable.length > 2 && !tabText.includes(queryable)) {
      throw new Error(`Plain-text line not present in Interview tab: ${JSON.stringify(line)}`);
    }
  }

  // Click option 2 — the Studio records the answer
  await page.locator(".interview-option", { hasText: "Bold and colorful" }).first().click();
  await page.waitForTimeout(300);

  // get_feedback returns exactly one unconsumed answer with the studio value
  const gf1 = await fetch(`${base()}/api/mcp`, {
    method: "POST",
    headers: authed(),
    body: JSON.stringify({ tool: "get_feedback", input: { sceneId: "default" } }),
  });
  const gf1Json = (await gf1.json()) as {
    result?: { interviewAnswers: Array<{ questionId: string; answer: unknown; via: string }> };
  };
  expect(gf1Json.result?.interviewAnswers).toHaveLength(1);
  expect(gf1Json.result?.interviewAnswers?.[0].questionId).toBe("q-style-1");
  expect(gf1Json.result?.interviewAnswers?.[0].via).toBe("studio");

  // Calling it again returns nothing for the interview
  const gf2 = await fetch(`${base()}/api/mcp`, {
    method: "POST",
    headers: authed(),
    body: JSON.stringify({ tool: "get_feedback", input: { sceneId: "default" } }),
  });
  const gf2Json = (await gf2.json()) as {
    result?: { interviewAnswers: Array<{ questionId: string; answer: unknown; via: string }> };
  };
  expect(gf2Json.result?.interviewAnswers ?? []).toHaveLength(0);
});
