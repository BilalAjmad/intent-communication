import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// M2.C: hand-rolled drag + resize on the Studio canvas overlay.
// Every gesture commits ONE atomic style op through /api/object-style.
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene(style: Record<string, unknown> = {}) {
  return {
    version: 1,
    revision: 3,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
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
        props: { layout: "flex", direction: "column" }, style, meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Drag Test", tags: [] },
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

async function seed(options: { style?: Record<string, unknown>; locked?: boolean } = {}): Promise<void> {
  const { style = { position: "absolute", left: "100px", top: "50px", width: "200px", height: "120px" }, locked = false } = options;
  tmpDir = resolve(os.tmpdir(), `.test-drag-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.mkdir(resolve(tmpDir, ".intent", "locks"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(makeScene(style)), "utf-8");
  if (locked) {
    await fs.writeFile(
      resolve(tmpDir, ".intent", "locks", "default.locks.json"),
      JSON.stringify({ version: 1, lockedObjects: [OBJECT], updatedAt: new Date().toISOString(), owners: {} }),
      "utf-8",
    );
  }
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
}

test.afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

async function readObjectStyle(): Promise<Record<string, unknown>> {
  const scene = JSON.parse(await fs.readFile(resolve(tmpDir, ".intent", "scenes", "default.json"), "utf-8")) as {
    objects: Record<string, { style: Record<string, unknown> }>;
  };
  return scene.objects[OBJECT]?.style ?? {};
}

test("drag on the canvas moves the object and persists via one atomic style op", async ({ page }) => {
  await seed();
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Drag Test", { timeout: 8000 });

  // Select the object via the layers panel (its name is the object id).
  await page.locator(".layer-item", { hasText: OBJECT }).first().click();
  const box = page.locator(".selection-box.drag-enabled");
  await expect(box).toBeVisible({ timeout: 8000 });

  const b = await box.boundingBox();
  expect(b).toBeTruthy();
  if (!b) return;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + 36, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => (await readObjectStyle()).left, { timeout: 8000 }).toBe("140px");
  const style = await readObjectStyle();
  expect(style.top).toBe("86px");
  expect(style.position).toBe("absolute");
  expect(style.width).toBe("200px");
});

test("resize handle grows the object and persists width/height", async ({ page }) => {
  await seed();
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Drag Test", { timeout: 8000 });

  await page.locator(".layer-item", { hasText: OBJECT }).first().click();
  const handle = page.locator(".resize-handle");
  await expect(handle).toBeVisible({ timeout: 8000 });

  const hb = await handle.boundingBox();
  expect(hb).toBeTruthy();
  if (!hb) return;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 40, hb.y + hb.height / 2 + 20, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => (await readObjectStyle()).width, { timeout: 8000 }).toBe("240px");
  const style = await readObjectStyle();
  expect(style.height).toBe("140px");
});

test("drag converts a flow-positioned object to absolute at the drop point", async ({ page }) => {
  await seed({ style: {} });
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Drag Test", { timeout: 8000 });

  await page.locator(".layer-item", { hasText: OBJECT }).first().click();
  const box = page.locator(".selection-box.drag-enabled");
  await expect(box).toBeVisible({ timeout: 8000 });
  const b = await box.boundingBox();
  expect(b).toBeTruthy();
  if (!b) return;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 44, b.y + b.height / 2 + 24, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => (await readObjectStyle()).position, { timeout: 8000 }).toBe("absolute");
  const style = await readObjectStyle();
  expect(String(style.left)).toMatch(/px$/);
});

test("a locked object shows no drag or resize affordances", async ({ page }) => {
  await seed({ locked: true });
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Drag Test", { timeout: 8000 });

  await page.locator(".layer-item", { hasText: OBJECT }).first().click();
  await expect(page.locator(".selection-box")).toBeVisible({ timeout: 8000 });
  await expect(page.locator(".selection-box.drag-enabled")).toHaveCount(0);
  await expect(page.locator(".resize-handle")).toHaveCount(0);
});
