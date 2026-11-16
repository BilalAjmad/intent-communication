import { test, expect, beforeEach, afterEach } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { createServer } from "../packages/server/dist/index.js";

// M2.B deferred: axe across the full Studio tab set, not just the shell —
// Interview and Profile tabs included. Zero critical/serious per WCAG 2.0 A/AA.
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene() {
  return {
    version: 1, revision: 2,
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
        id: OBJECT, type: "text", parentId: SCREEN, children: [],
        props: { content: "Hello" }, style: {}, meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Axe Tabs", tags: [] },
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

const tabs = [
  { tab: "Interview", panel: "#interview-panel" },
  { tab: "Profile", panel: "#profile-panel" },
  { tab: "Feedback", panel: "#feedback-panel" },
];

// The Studio CSP blocks inline scripts; axe injection needs the bypass (CSP
// enforcement itself is covered elsewhere).
test.use({ bypassCSP: true });

beforeEach(async () => {
  tmpDir = resolve(os.tmpdir(), `.test-axe-tabs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(makeScene()), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
});

afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

for (const { tab, panel } of tabs) {
  test(`axe: no critical or serious violations on the ${tab} tab`, async ({ page }) => {
    const axePath = resolve(process.cwd(), "node_modules", "axe-core", "axe.min.js");
    await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
    await expect(page.locator("#project-name")).toHaveText("Axe Tabs", { timeout: 8000 });

    await page.getByRole("tab", { name: tab }).click();
    await expect(page.locator(panel)).toBeVisible({ timeout: 8000 });

    // addScriptTag({path}) is blocked by the page CSP; evaluate-injection is not.
    const axeSource = readFileSync(resolve(process.cwd(), "node_modules", "axe-core", "axe.min.js"), "utf-8");
    await page.evaluate((source) => {
      const script = document.createElement("script");
      script.textContent = source;
      document.head.appendChild(script);
    }, axeSource);
    const axeAvailable = await page.evaluate(() => typeof window.axe);
    console.log(`axe available after injection (${tab} tab):`, axeAvailable);

    const violations = await page.evaluate(async (target) => {
      const el = document.querySelector(target);
      const results = await (window as unknown as { axe: { run: (ctx: Element | null, opts: object) => Promise<{ violations: Array<{ id: string; impact: string | null; help: string }> }> } }).axe.run(
        el,
        { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } },
      );
      return results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help }));
    }, panel);

    const criticalOrSerious = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    if (criticalOrSerious.length > 0) {
      console.log(`${tab} tab critical/serious violations:`, JSON.stringify(criticalOrSerious, null, 2));
    }
    expect(criticalOrSerious).toEqual([]);
  });
}
