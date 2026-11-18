import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// Device frames + keyboard undo (design.md 4.2/4.7).
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const VERSION_FILE = "2026-11-16T00-00-00-000Z-r1-before-send.json";

function makeScene(name: string, revision: number) {
  return {
    version: 1, revision,
    createdAt: "2026-11-16T00:00:00.000Z", updatedAt: "2026-11-16T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [OBJECT],
        props: { title: name, width: 1280, height: 720 },
        style: {}, meta: {},
      },
    },
    objects: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [OBJECT],
        props: { title: name, width: 1280, height: 720 },
        style: {}, meta: {},
      },
      [OBJECT]: {
        id: OBJECT, type: "text", parentId: SCREEN, children: [],
        props: { content: "Hello" }, style: {}, meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name, tags: [] },
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

test.beforeEach(async () => {
  tmpDir = resolve(os.tmpdir(), `.test-device-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.mkdir(resolve(tmpDir, ".intent", "versions"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(makeScene("Current Draft", 4)), "utf-8");
  await fs.writeFile(resolve(tmpDir, ".intent", "versions", VERSION_FILE), JSON.stringify(makeScene("Restored Original", 3)), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
});

test.afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("device frame buttons resize the preview iframe", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Current Draft", { timeout: 8000 });

  // Desktop is default-active and wider than the phone frame.
  await expect(page.locator("#frame-desktop")).toHaveAttribute("aria-pressed", "true", { timeout: 8000 });
  const desktopBox = await page.locator(".iframe-wrap").boundingBox();
  expect(desktopBox!.width).toBeGreaterThan(500);

  await page.locator("#frame-phone").click();
  await page.waitForFunction(
    () => document.querySelector(".iframe-wrap")!.getBoundingClientRect().width === 375,
    { timeout: 8000 },
  );
  await expect(page.locator("#frame-phone")).toHaveAttribute("aria-pressed", "true");

  await page.locator("#frame-tablet").click();
  await page.waitForFunction(
    () => document.querySelector(".iframe-wrap")!.getBoundingClientRect().width === 834,
    { timeout: 8000 },
  );
  await expect(page.locator("#frame-tablet")).toHaveAttribute("aria-pressed", "true");

  await page.locator("#frame-desktop").click();
  await page.waitForFunction(
    () => document.querySelector(".iframe-wrap")!.getBoundingClientRect().width > 500,
    { timeout: 8000 },
  );
  await expect(page.locator("#frame-desktop")).toHaveAttribute("aria-pressed", "true");
});

test("Ctrl+Z restores the latest snapshot (keyboard undo)", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Current Draft", { timeout: 8000 });

  // Focus is in the document body (not a text input) — Ctrl+Z undoes.
  await page.keyboard.press("Control+z");

  await expect(page.locator("#project-name")).toHaveText("Restored Original", { timeout: 8000 });
  // Revision was bumped (4 -> restores bump to current+1 = 5).
  const scene = JSON.parse(await fs.readFile(resolve(tmpDir, ".intent", "scenes", "default.json"), "utf-8")) as {
    revision: number;
    metadata: { name: string };
  };
  expect(scene.metadata.name).toBe("Restored Original");
  expect(scene.revision).toBe(5);
});
