import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "../packages/server/dist/index.js";

// M2.D integration demo (plan.md §9, M2.D): a 3-screen prototype shown
// through the whole loop on this machine:
//   seed 3-screen salon-booking scene → Studio opens it → human draws a
//   pencil annotation on a button → feedback patch + annotation attached →
//   Send to agent → agent roundtrip via /api/mcp get_feedback (no API key,
//   no external service) → agent applies a patch via apply_patch → export
//   renders the patched copy → zero network requests.

const SCREEN_HOME = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const SCREEN_SLOT = "s_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const SCREEN_DONE = "s_03ARZ3NDEKTSV4RRFFQ69G5FAV";
const HEADLINE = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const CTA = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const INPUT = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";

const scene = {
  version: 1,
  revision: 1,
  createdAt: "2026-11-16T00:00:00.000Z",
  updatedAt: "2026-11-16T00:00:00.000Z",
  screens: {
    [SCREEN_HOME]: {
      id: SCREEN_HOME, type: "screen", parentId: null, children: [HEADLINE, CTA],
      props: { title: "Home", width: 390, height: 844 },
      style: {}, meta: {},
    },
    [SCREEN_SLOT]: {
      id: SCREEN_SLOT, type: "screen", parentId: null, children: [INPUT],
      props: { title: "Pick a slot", width: 390, height: 844 },
      style: {}, meta: {},
    },
    [SCREEN_DONE]: {
      id: SCREEN_DONE, type: "screen", parentId: null, children: [],
      props: { title: "Booked", width: 390, height: 844 },
      style: {}, meta: {},
    },
  },
  objects: {
    [SCREEN_HOME]: {
      id: SCREEN_HOME, type: "screen", parentId: null, children: [HEADLINE, CTA],
      props: { title: "Home", width: 390, height: 844 }, style: {}, meta: {},
    },
    [SCREEN_SLOT]: {
      id: SCREEN_SLOT, type: "screen", parentId: null, children: [INPUT],
      props: { title: "Pick a slot", width: 390, height: 844 }, style: {}, meta: {},
    },
    [SCREEN_DONE]: {
      id: SCREEN_DONE, type: "screen", parentId: null, children: [],
      props: { title: "Booked", width: 390, height: 844 }, style: {}, meta: {},
    },
    [HEADLINE]: {
      id: HEADLINE, type: "text", parentId: SCREEN_HOME, children: [],
      props: { content: "Welcome to our salon", fontSize: 24 }, style: {}, meta: {},
    },
    [CTA]: {
      id: CTA, type: "button", parentId: SCREEN_HOME, children: [],
      props: { label: "Book a slot", variant: "primary" },
      style: {}, meta: {},
      states: { loading: { style: { opacity: 0.6 } } },
    },
    [INPUT]: {
      id: INPUT, type: "input", parentId: SCREEN_SLOT, children: [],
      props: { type: "text", placeholder: "e.g. Friday 3pm" }, style: {}, meta: {},
      states: { filled: { style: {} }, error: { style: {} } },
    },
  },
  screenOrder: [SCREEN_HOME, SCREEN_SLOT, SCREEN_DONE],
  metadata: { name: "Salon Demo", tags: [] },
};

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

const origin = () => ({ Origin: `http://127.0.0.1:${port}` });

async function seed(): Promise<void> {
  tmpDir = resolve(os.tmpdir(), `.test-m2d-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(scene), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
}

async function exchange(): Promise<string> {
  const token = server.getSessionToken();
  const response = await fetch(`http://127.0.0.1:${port}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...origin() },
    body: JSON.stringify({ token }),
  });
  expect(response.status).toBe(204);
  const setCookie = response.headers.get("Set-Cookie") ?? "";
  const sessionId = (setCookie.match(/intent_session=([^;]+)/) || [])[1] ?? "";
  return `intent_session=${sessionId}`;
}

async function mcpCall(tool: string, input: unknown, cookie: string) {
  const response = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
    body: JSON.stringify({ tool, input }),
  });
  const body = (await response.json()) as { success?: boolean; result?: never; error?: { code?: string } };
  return { status: response.status, body };
}

test.beforeEach(seed);
test.afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("M2.D demo: seed → annotate → feedback → agent get_feedback → apply_patch → export", async ({ page }) => {
  const cookie = await exchange();

  // Studio opens the seeded scene.
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Salon Demo", { timeout: 8000 });
  await expect(page.locator("#preview-frame")).toBeVisible();

  // Draw a pencil annotation on the CTA button.
  await page.locator(".layer-item", { hasText: "button" }).first().click();
  await page.click("#annotate-toggle");
  const canvas = page.locator("#annotation-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x - 30, y - 10);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 20, { steps: 6 });
  await page.mouse.up();
  await page.click("#tab-feedback");
  await expect(page.locator(".annotation-item")).toHaveCount(1, { timeout: 8000 });

  // Attach annotation + text to a feedback patch, add to queue, send.
  await page.locator("#feedback-text").fill("CTA should mention the service");
  await page.locator("#add-to-queue").click();
  await expect(page.locator("#toast")).toContainText("Added to the queue", { timeout: 8000 });
  await page.click("#tray-toggle");
  await page.locator("#send-btn").click();
  await expect(page.locator("#toast")).toContainText("Sent", { timeout: 8000 });

  // Agent roundtrip over the MCP HTTP surface — no API key, no external services.
  const feedback = await mcpCall("get_feedback", { sceneId: "default" }, cookie);
  expect(feedback.status).toBe(200);
  const feedbackData = feedback.body.result as unknown as {
    feedback: Array<{ objectId: string; annotationIds?: string[] }>;
    annotations: Array<{ id: string; objectId: string | null; status: string; anchor: { x: number } | null }>;
  };
  expect(feedbackData.feedback.length).toBeGreaterThan(0);
  expect(feedbackData.annotations.length).toBeGreaterThan(0);
  expect(feedbackData.annotations[0]?.status).toBe("sent");

  // Agent applies a patch via apply_patch (path format: props.content).
  const revision = (
    (await (await fetch(`http://127.0.0.1:${port}/api/scene?scene=default`, { headers: { Cookie: cookie } })).json()) as {
      scene: { revision: number };
    }
  ).scene.revision;
  const patchId = "p_01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const applied = await mcpCall(
    "apply_patch",
    {
      patch: {
        id: patchId,
        sceneId: "default",
        baseRevision: revision,
        objectId: HEADLINE,
        op: "set",
        path: "props.content",
        value: "Book your salon chair online",
        createdAt: "2026-11-16T00:00:00.000Z",
        status: "draft",
        appliedAt: null,
      },
    },
    cookie,
  );
  expect(applied.status).toBe(200);
  const appliedData = applied.body.result as unknown as { success: boolean; revision: number };
  expect(appliedData.success).toBe(true);
  expect(appliedData.revision).toBe(revision + 1);

  // Export renders the patched copy with zero external requests (fresh tab so
  // the Studio session's SSE/polling does not pollute the request log).
  const cliPath = resolve(process.cwd(), "packages", "cli", "dist", "cli.js");
  const outHtml = resolve(tmpDir, "export-default.html");
  execFileSync("node", [cliPath, "export", "--path", tmpDir, "--format", "html", "--output", outHtml], { stdio: "pipe", timeout: 60000 });
  const html = await fs.readFile(outHtml, "utf-8");
  expect(html).toContain("Book your salon chair online");
  expect(html).toContain("intent-screen");

  const exportPage = await page.context().newPage();
  const requests: string[] = [];
  exportPage.on("request", (req) => requests.push(req.url()));
  await exportPage.goto(`file:///${outHtml.replace(/\\/g, "/")}`);
  await expect(exportPage.locator("body")).toContainText("Book your salon chair online");
  await exportPage.waitForTimeout(500);
  expect(requests.filter((r) => !r.startsWith("file://"))).toHaveLength(0);
  await exportPage.close();
});
