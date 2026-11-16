import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// trd 17.2 acceptance-rate metric, end to end: seeded first-render baseline +
// an applied feedback entry -> Inspector shows the rate. Without a baseline,
// the section says so instead of fabricating a number.
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BASELINE_FILE = "2026-11-16T00-00-00-000Z-r1-first-render.json";

function makeScene(name: string, revision: number, extraObjects: Record<string, unknown> = {}) {
  return {
    version: 1,
    revision,
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
      ...extraObjects,
    },
    screenOrder: [SCREEN],
    metadata: { name, tags: [] },
  };
}

function makeFeedback() {
  return [{
    id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    sceneId: "default",
    objectId: OBJECT,
    kind: "visual",
    message: "Make the text tighter",
    severity: "medium",
    status: "applied",
    createdAt: "2026-11-16T00:00:30.000Z",
    sentAt: "2026-11-16T00:00:30.000Z",
    appliedAt: "2026-11-16T01:00:00.000Z",
    patchId: null,
  }];
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

async function seed(options: { baseline?: boolean; feedback?: boolean }): Promise<void> {
  const { baseline = true, feedback = true } = options;
  tmpDir = resolve(os.tmpdir(), `.test-metrics-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.mkdir(resolve(tmpDir, ".intent", "versions"), { recursive: true });
  await fs.mkdir(resolve(tmpDir, ".intent", "feedback"), { recursive: true });
  await fs.writeFile(
    resolve(tmpDir, ".intent", "scenes", "default.json"),
    JSON.stringify(makeScene("Metrics Test", 3, {
      o_03ARZ3NDEKTSV4RRFFQ69G5FAV: {
        id: "o_03ARZ3NDEKTSV4RRFFQ69G5FAV", type: "button", parentId: SCREEN, children: [],
        props: { label: "New" }, style: {}, meta: {},
      },
    })),
    "utf-8",
  );
  if (baseline) {
    await fs.writeFile(resolve(tmpDir, ".intent", "versions", BASELINE_FILE), JSON.stringify(makeScene("Baseline", 1)), "utf-8");
  }
  if (feedback) {
    await fs.writeFile(resolve(tmpDir, ".intent", "feedback", "default.json"), JSON.stringify(makeFeedback()), "utf-8");
  }
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
}

test.afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("Inspector acceptance metric: rate, fraction and add/remove counts", async ({ page }) => {
  await seed({ baseline: true, feedback: true });
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Metrics Test", { timeout: 8000 });

  await expect(page.locator(".metric-value")).toHaveText("0.0%", { timeout: 8000 });
  await expect(page.locator(".versions-section", { hasText: "Acceptance" }))
    .toContainText("0 of 1 baseline objects unchanged");
  await expect(page.locator(".versions-section", { hasText: "Acceptance" }))
    .toContainText("1 added");
});

test("Inspector acceptance metric: honest empty state without a baseline", async ({ page }) => {
  await seed({ baseline: false, feedback: false });
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Metrics Test", { timeout: 8000 });

  await expect(page.locator(".versions-section", { hasText: "Acceptance" }))
    .toContainText("Not enough data yet", { timeout: 8000 });
});
