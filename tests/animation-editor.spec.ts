import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// trd 13.6: animation authoring surface — apply a transition to the selected
// object via the Inspector, then remove it. Same /api/object-style pipeline.
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
        props: { layout: "flex" }, style: { width: "200px", height: "120px" }, meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Animation Test", tags: [] },
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

test.beforeEach(async () => {
  tmpDir = resolve(os.tmpdir(), `.test-anim-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

test("animation editor: apply a transition, then remove it", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Animation Test", { timeout: 8000 });

  await page.locator(".layer-item", { hasText: OBJECT }).first().click();
  // Row present with two dropdowns and buttons.
  const row = page.locator(".animation-row");
  await expect(row).toBeVisible({ timeout: 8000 });
  await expect(row.locator("select").nth(0)).toHaveValue("background-color");

  // Apply a 200ms transition.
  await row.locator("button.anim-apply").click();
  await expect.poll(async () => (await readStyle()).transition, { timeout: 8000 }).toBe("background-color 200ms ease");

  // Remove it — engine drops the empty declaration so the transition is gone.
  await row.locator("button", { hasText: "Remove transition" }).click();
  // The write merges transition:"" into the stored style; the engine
  // emits nothing for it, so the transition is visually and structurally gone.
  await expect.poll(async () => (await readStyle()).transition, { timeout: 8000 }).toBe("");
});
