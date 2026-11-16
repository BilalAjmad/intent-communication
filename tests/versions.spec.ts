import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// Snapshots (saveBeforeSendVersion) → list in the Inspector → Restore → scene swapped.
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const VERSION_FILE = "2026-11-16T00-00-00-000Z-r1-before-send.json";

function makeScene(name: string, revision: number) {
  return {
    version: 1,
    revision,
    createdAt: "2026-11-15T00:00:00.000Z",
    updatedAt: "2026-11-15T00:00:00.000Z",
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
  tmpDir = resolve(os.tmpdir(), `.test-versions-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.mkdir(resolve(tmpDir, ".intent", "versions"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(makeScene("Versions Test", 2)), "utf-8");
  await fs.writeFile(resolve(tmpDir, ".intent", "versions", VERSION_FILE), JSON.stringify(makeScene("Restored Version", 1)), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
});

test.afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Inspector snapshots: list, restore, scene swapped, revision bumped", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());

  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Versions Test", { timeout: 8000 });

  // The Inspector lists the snapshot.
  const item = page.locator(".version-item", { hasText: "r1" });
  await expect(item).toBeVisible({ timeout: 8000 });

  // Restore it.
  await item.getByRole("button", { name: "Restore" }).click();
  await expect(page.locator("#toast")).toContainText("Snapshot restored", { timeout: 8000 });

  // The project name in the topbar reflects the restored scene.
  await expect(page.locator("#project-name")).toHaveText("Restored Version", { timeout: 8000 });

  // The scene file was restored and its revision bumped (2 -> 3).
  const scene = JSON.parse(
    await fs.readFile(resolve(tmpDir, ".intent", "scenes", "default.json"), "utf-8"),
  ) as { revision: number; metadata: { name: string } };
  expect(scene.metadata.name).toBe("Restored Version");
  expect(scene.revision).toBe(3);
});
