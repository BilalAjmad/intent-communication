import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";
import { buildPreviewDocument } from "../packages/studio/dist/index.js";

// trd 13.6 keyframes editor — add a scene keyframe via the Inspector, apply it
// to the selected object, and prove the exported/preview document carries it.
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene() {
  return {
    version: 1, revision: 3,
    createdAt: "2026-11-18T00:00:00.000Z", updatedAt: "2026-11-18T00:00:00.000Z",
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
        props: { layout: "flex" }, style: { width: "200px", height: "120px" }, meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Keyframes Test", tags: [] },
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

test.beforeEach(async () => {
  tmpDir = resolve(os.tmpdir(), `.test-kf-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

test("keyframes editor: add a keyframe, apply it to the selected object", async ({ page }) => {
  const scenePath = () => resolve(tmpDir, ".intent", "scenes", "default.json");
  const readScene = async () =>
    JSON.parse(await fs.readFile(scenePath(), "utf-8")) as {
      metadata: { keyframes?: Record<string, Record<string, Record<string, string>>> };
      objects: Record<string, { style: Record<string, unknown> }>;
    };

  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Keyframes Test", { timeout: 8000 });

  await page.locator(".layer-item", { hasText: OBJECT }).first().click();
  const kfRow = page.locator(".keyframes-row");
  await expect(kfRow).toBeVisible({ timeout: 8000 });
  await expect(kfRow.locator(".keyframes-empty")).toBeVisible();

  // Add a keyframe.
  await kfRow.locator(".keyframes-add input").fill("fade-up");
  await kfRow.locator(".keyframes-add button", { hasText: "Add keyframe" }).click();
  await expect(kfRow.locator(".keyframe-card code", { hasText: "fade-up" })).toBeVisible({ timeout: 8000 });
  await expect.poll(async () => (await readScene()).metadata.keyframes?.["fade-up"]?.from?.opacity, { timeout: 8000 }).toBe("0");

  // Apply it to the selected object via the card's Apply button.
  await kfRow.locator(".keyframe-card", { hasText: "fade-up" }).locator("button", { hasText: "Animate selected" }).click();
  await expect.poll(async () => (await readScene()).objects[OBJECT]?.style.animation, { timeout: 8000 }).toBe("fade-up 600ms ease infinite");

  // The generated document carries the @keyframes rule and the animation declaration.
  const doc = buildPreviewDocument(JSON.parse(await fs.readFile(scenePath(), "utf-8")) as never);
  expect(doc).toContain("@keyframes fade-up");
  expect(doc).toContain("animation: fade-up 600ms ease infinite");
});
