import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// Lint chip in the topbar (trd 11.3): violations surface as a badge; click
// opens a panel listing rule ids; Escape closes.
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BUTTON = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene(withViolation: boolean) {
  const button = {
    id: BUTTON,
    type: "button",
    parentId: SCREEN,
    children: [],
    props: { label: "Go", variant: "primary" },
    style: {},
    meta: {},
    ...(withViolation ? {} : { states: { loading: { style: { opacity: 0.6 } } } }),
  };
  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [BUTTON],
        props: { title: "Lint Test", width: 1280, height: 720 },
        style: {}, meta: {},
      },
    },
    objects: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [BUTTON],
        props: { title: "Lint Test", width: 1280, height: 720 },
        style: {}, meta: {},
      },
      [BUTTON]: button,
    },
    screenOrder: [SCREEN],
    metadata: { name: "Lint Test", tags: [] },
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

async function seed(scene: object): Promise<void> {
  tmpDir = resolve(os.tmpdir(), `.test-lint-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(scene), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
}

test.afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("lint chip shows violations; click opens a panel listing rule ids; Escape closes", async ({ page }) => {
  await seed(makeScene(true));
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Lint Test", { timeout: 8000 });

  // Badge shows at least one error (L-STATES for the missing loading state).
  const chip = page.locator("#lint-chip");
  await expect(chip).toBeVisible({ timeout: 8000 });
  await expect(chip).toContainText(/error/i);

  // Click opens the panel listing the rule id.
  await chip.click();
  const panel = page.locator("#lint-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("L-STATES");

  // Escape closes the panel.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

test("lint chip is green when the scene passes the ruleset", async ({ page }) => {
  await seed(makeScene(false));
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  const chip = page.locator("#lint-chip");
  await expect(chip).toBeVisible({ timeout: 8000 });
  await expect(chip).toHaveClass(/ok/);
  await expect(chip).toContainText(/clean/i);

  // Clicking opens a panel that says no violations.
  await chip.click();
  await expect(page.locator("#lint-panel")).toContainText("No violations");
});
