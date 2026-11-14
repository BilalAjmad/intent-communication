import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// AC-M1-09 — the full Studio roundtrip driven through the real UI:
//   select an object (real canvas click) → write feedback → draft → Send →
//   an agent applies a patch via /api (real /api/mcp apply_patch) →
//   the shell receives the SSE update and the queue row shows "applied".
//
// Drafts are on disk but invisible to get_feedback until Send (trd 6.1/6.4).

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BUTTON = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const AGENT_PATCH_ID = "p_01ARZ3NDEKTSV4RRFFQ69G5FAV";

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
        children: [TEXT, BUTTON],
        props: { title: "Roundtrip", width: 390, height: 844 },
        style: {},
        meta: {},
      },
    },
    objects: {
      [TEXT]: {
        id: TEXT,
        type: "text",
        parentId: SCREEN,
        children: [],
        props: { content: "Hello Roundtrip", fontSize: 20 },
        style: {},
        meta: {},
      },
      [BUTTON]: {
        id: BUTTON,
        type: "button",
        parentId: SCREEN,
        children: [],
        props: { label: "Confirm Booking", variant: "primary" },
        style: {},
        meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Roundtrip Test", tags: [] },
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;
let token: string;

const base = () => `http://127.0.0.1:${port}`;
const authed = () => ({
  "Content-Type": "application/json",
  Origin: base(),
  Cookie: `intent_session=${session}`,
});

let session: string;

test.beforeAll(async () => {
  const scene = makeScene();
  tmpDir = resolve(os.tmpdir(), `.test-roundtrip-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(scene), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
  token = server.getSessionToken();

  const exchange = await fetch(`${base()}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base() },
    body: JSON.stringify({ token }),
  });
  expect(exchange.status).toBe(204);
  session = (exchange.headers.get("Set-Cookie") ?? "").split(";")[0].replace("intent_session=", "");
});

test.afterAll(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("select → feedback → draft → Send → agent apply_patch → status shows applied in the page", async ({ page }) => {
  // 1. The real shell loads; the token fragment is exchanged for a session cookie and scrubbed
  await page.goto(`${base()}/#t=${token}`);
  await expect(page.locator("#project-name")).toHaveText("Roundtrip Test", { timeout: 8000 });
  expect(await page.evaluate(() => window.location.hash)).toBe("");

  const frame = page.frameLocator("#preview-frame");

  // 2. Select the text object in the real canvas (click → protocol message → Layers reflect it)
  await frame.locator(`[data-object-id="${TEXT}"]`).click();
  await expect(page.locator(`.layer-item[data-object-id="${TEXT}"]`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#feedback-target")).toHaveText(TEXT);

  // 3. Open the Feedback tab, write feedback, pick a chip, add to queue (draft)
  await page.locator("#tab-feedback").click();
  await page.locator("#feedback-text").fill("Heading is too long for this screen");
  await page.locator('.chip[data-chip="simpler"]').click();
  await page.locator("#add-to-queue").click();
  await expect(page.locator("#tray-summary")).toContainText("1 draft", { timeout: 5000 });
  await expect(page.locator("#tray-summary")).toContainText("0 sent");

  // 4. Drafts are invisible to the agent's get_feedback until Send
  const draftView = await fetch(`${base()}/api/mcp`, {
    method: "POST",
    headers: authed(),
    body: JSON.stringify({ tool: "get_feedback", input: { sceneId: "default" } }),
  });
  const draftJson = (await draftView.json()) as { result?: { feedback?: unknown[] } };
  expect(draftJson.result?.feedback?.length ?? 0).toBe(0);

  // 5. Send — the tray switches to “waiting for the agent” with a Copy-prompt path
  await page.locator("#send-btn").click();
  await expect(page.locator("#tray-summary")).toContainText("0 draft · 1 sent", { timeout: 5000 });
  await expect(page.locator("#waiting-banner")).toBeVisible();
  await expect(page.locator("#copy-prompt")).toBeVisible();

  // 6. The agent sees the sent feedback
  const sentView = await fetch(`${base()}/api/mcp`, {
    method: "POST",
    headers: authed(),
    body: JSON.stringify({ tool: "get_feedback", input: { sceneId: "default" } }),
  });
  const sentJson = (await sentView.json()) as { result?: { feedback?: Array<{ status: string }> } };
  expect(sentJson.result?.feedback?.length).toBe(1);
  expect(sentJson.result?.feedback?.[0]?.status).toBe("sent");

  // 7. The agent applies a patch via /api (real apply_patch)
  const applyRes = await fetch(`${base()}/api/mcp`, {
    method: "POST",
    headers: authed(),
    body: JSON.stringify({
      tool: "apply_patch",
      input: {
        patch: {
          id: AGENT_PATCH_ID,
          sceneId: "default",
          baseRevision: 1,
          objectId: TEXT,
          op: "set",
          path: "props.content",
          value: "Short",
          createdAt: new Date().toISOString(),
          status: "sent",
        },
      },
    }),
  });
  expect(applyRes.status).toBe(200);
  const applyJson = (await applyRes.json()) as { success: boolean; result?: { success?: boolean; revision?: number } };
  expect(applyJson.success).toBe(true);
  expect(applyJson.result?.revision).toBe(2);

  // 8. The shell's SSE client receives patch.changed/revision; the row shows applied
  await expect(page.locator("#tray-summary")).toContainText("1 applied", { timeout: 8000 });
  await expect(page.locator("#tray-summary")).toContainText("0 draft · 0 sent");
  // The waiting banner hides once nothing is outstanding
  await expect(page.locator("#waiting-banner")).toBeHidden();

  const appliedRow = page.locator(".queue-item .status-applied");
  await expect(appliedRow).toHaveCount(1);
  await expect(appliedRow).toContainText("Applied");
});
