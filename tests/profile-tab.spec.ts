import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// trd 17.1: Studio Profile tab — list, edit, delete the learned intent profile.
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene() {
  return {
    version: 1,
    revision: 2,
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
        id: OBJECT, type: "text", parentId: SCREEN, children: [],
        props: { content: "Hello" }, style: {}, meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Profile Test", tags: [] },
  };
}

function makeProfileEntry() {
  return {
    schemaVersion: 1,
    entries: [
      {
        id: "q_01ARZ3NDEKTSV4RRFFQ69G5FAV",
        key: "style.density",
        value: "compact",
        text: "prefers a compact density",
        source: { kind: "answer", refs: ["q-step-1"] },
        count: 2,
        confidence: 0.95,
        createdAt: "2026-11-16T00:00:00.000Z",
        updatedAt: "2026-11-16T00:00:00.000Z",
      },
    ],
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

test.beforeEach(async () => {
  tmpDir = resolve(os.tmpdir(), `.test-profile-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(makeScene()), "utf-8");
  await fs.writeFile(resolve(tmpDir, ".intent", "intent-profile.json"), JSON.stringify(makeProfileEntry()), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
});

test.afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Profile tab: lists the remembered entry, edit saves, delete removes it", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Profile Test", { timeout: 8000 });

  // Switch to the Profile tab.
  await page.getByRole("tab", { name: "Profile" }).click();
  await expect(page.locator(".profile-text")).toHaveText("prefers a compact density", { timeout: 8000 });
  await expect(page.locator(".profile-meta")).toContainText("95% confidence");

  // Edit the display text; Save persists through the API.
  await page.getByRole("button", { name: "Edit profile entry: prefers a compact density" }).click();
  await page.locator(".profile-edit-input").fill("prefers compact spacing");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".profile-text")).toHaveText("prefers compact spacing", { timeout: 8000 });

  // Reload from disk to confirm the PATCH was persisted.
  const onDisk = JSON.parse(await fs.readFile(resolve(tmpDir, ".intent", "intent-profile.json"), "utf-8")) as {
    entries: { text: string }[];
  };
  expect(onDisk.entries[0]?.text).toBe("prefers compact spacing");

  // Delete removes the entry everywhere.
  await page.getByRole("button", { name: "Delete profile entry: prefers compact spacing" }).click();
  await expect(page.locator("#profile-body")).toContainText("Nothing learned yet", { timeout: 8000 });
  const afterDelete = JSON.parse(await fs.readFile(resolve(tmpDir, ".intent", "intent-profile.json"), "utf-8")) as {
    entries: unknown[];
  };
  expect(afterDelete.entries).toHaveLength(0);
});

test("Profile tab: honest empty state when nothing is learned", async ({ page }) => {
  await fs.rm(resolve(tmpDir, ".intent", "intent-profile.json"));
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Profile Test", { timeout: 8000 });

  await page.getByRole("tab", { name: "Profile" }).click();
  await expect(page.locator("#profile-body")).toContainText("Nothing learned yet", { timeout: 8000 });
});
