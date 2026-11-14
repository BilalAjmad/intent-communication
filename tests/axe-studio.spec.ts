import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// Axe accessibility check — Studio shell must have no critical/serious violations (task 4).

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BUTTON = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene() {
  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN,
        type: "screen",
        parentId: null,
        children: [TEXT, BUTTON],
        props: { title: "Axe Shell", width: 390, height: 844 },
        style: {},
        meta: {},
      },
    },
    objects: {
      [TEXT]: {
        id: TEXT,
        type: "text",
        parentId: SCREEN,
        children: [],
        props: { content: "Hello axe", fontSize: 20 },
        style: {},
        meta: {},
      },
      [BUTTON]: {
        id: BUTTON,
        type: "button",
        parentId: SCREEN,
        children: [],
        props: { label: "Confirm", variant: "primary" },
        style: {},
        meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Axe Shell", tags: [] },
  };
}

// The shell's CSP (script-src 'self') blocks any injected inline script, so the
// axe harness runs with CSP bypass. CSP enforcement for the shell is covered by
// TC-STU-01; this test is purely the accessibility scan.
test.use({ bypassCSP: true });

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

test.beforeAll(async () => {
  const scene = makeScene();
  tmpDir = resolve(os.tmpdir(), `.test-studio-axe-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(scene), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
});

test.afterAll(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("axe: no critical or serious violations on the Studio shell", async ({ page }) => {
  const axePath = resolve(process.cwd(), "node_modules", "axe-core", "axe.min.js");
  const axeSource = await fs.readFile(axePath, "utf-8");
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Axe Shell", { timeout: 8000 });

  // Configure an axe run for the shell's DOM (iframe content is opaque-origin by design — excluded)
  await page.evaluate((source) => {
    const script = document.createElement("script");
    script.textContent = source;
    document.head.appendChild(script);
  }, axeSource);

  const violations = await page.evaluate(async () => {
    const results = await (window as unknown as { axe: { run: (ctx: Element, opts: object) => Promise<{ violations: Array<{ id: string; impact: string | null; help: string; nodes: unknown[] }> }> } }).axe.run(document.body, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    });
    return results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help }));
  });

  const criticalOrSerious = violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  if (criticalOrSerious.length > 0) {
    console.log("Critical/serious violations:", JSON.stringify(criticalOrSerious, null, 2));
  }
  expect(criticalOrSerious).toEqual([]);
});
