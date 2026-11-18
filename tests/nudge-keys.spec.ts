import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// design.md 4.2: Arrow keys move the selected object by 4 px (Shift = 8 px).
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene() {
  return {
    version: 1, revision: 3,
    createdAt: "2026-11-16T00:00:00.000Z", updatedAt: "2026-11-16T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [OBJECT],
        props: { title: "Home", width: 1280, height: 720 },
        style: {}, meta: {},
      },
    },
    objects: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [OBJECT],
        props: { title: "Home", width: 1280, height: 720 },
        style: {}, meta: {},
      },
      [OBJECT]: {
        id: OBJECT, type: "container", parentId: SCREEN, children: [],
        props: { layout: "flex" }, style: { position: "absolute", left: "100px", top: "100px", width: "200px", height: "120px" }, meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Nudge Test", tags: [] },
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

test.beforeEach(async () => {
  tmpDir = resolve(os.tmpdir(), `.test-nudge-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(makeScene()), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
});

test.afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

async function readStyle(): Promise<Record<string, unknown>> {
  const scene = JSON.parse(await fs.readFile(resolve(tmpDir, ".intent", "scenes", "default.json"), "utf-8")) as {
    objects: Record<string, { style: Record<string, unknown> }>;
  };
  return scene.objects[OBJECT]?.style ?? {};
}

test("arrow keys nudge the selected object 4px, Shift+Arrow 8px, coalesced to one commit", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Nudge Test", { timeout: 8000 });

  await page.locator(".layer-item", { hasText: OBJECT }).first().click();
  // The nudge input path needs state.lastRects (the preview overlay) — on a slow
  // CI box the iframe may publish it a beat after the click, and keydowns are
  // silently dropped until then. Wait for the overlay to confirm selection.
  await expect(page.locator(".selection-box").first()).toBeVisible({ timeout: 8000 });
  // 4 + 4 + 8 = 16 px right in one burst.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("ArrowDown");

  await expect.poll(async () => (await readStyle()).left, { timeout: 8000 }).toBe("116px");
  expect((await readStyle()).top).toBe("104px");
});

test("arrow keys in the feedback textarea do not move the object", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Nudge Test", { timeout: 8000 });

  await page.locator(".layer-item", { hasText: OBJECT }).first().click();
  await page.getByRole("tab", { name: "Feedback" }).click();
  await page.locator("#feedback-text").click();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(700); // longer than the 300 ms debounce
  expect((await readStyle()).left).toBe("100px");
  expect((await readStyle()).top).toBe("100px");
});
