import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { exportToHtml } from "../packages/engine/dist/index.js";

test.describe("Visual differential test (S-1-13)", () => {
  const testDir = resolve(process.cwd(), ".test-visual-diff");
  const cliPath = resolve(process.cwd(), "packages", "cli", "dist", "cli.js");
  const sceneId = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const objectId = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

  const baseScene = {
    version: 1,
    revision: 0,
    createdAt: "2026-11-11T00:00:00.000Z",
    updatedAt: "2026-11-11T00:00:00.000Z",
    screens: {
      [sceneId]: {
        id: sceneId,
        type: "screen",
        parentId: null,
        children: [objectId],
        props: { title: "Visual Test", width: 1280, height: 720 },
        style: {},
        meta: {},
      },
    },
    objects: {
      [objectId]: {
        id: objectId,
        type: "text",
        parentId: sceneId,
        children: [],
        props: { content: "Hello World", fontSize: 16 },
        style: {},
        meta: {},
      },
    },
    screenOrder: [sceneId],
    metadata: { name: "Visual Test", tags: [] },
  };

  async function writeScene(scene: Record<string, unknown>) {
    const scenesDir = resolve(testDir, ".intent", "scenes");
    const locksDir = resolve(testDir, ".intent", "locks");
    await fs.mkdir(scenesDir, { recursive: true });
    await fs.mkdir(locksDir, { recursive: true });
    await fs.writeFile(resolve(scenesDir, "default.json"), JSON.stringify(scene, null, 0));
    await fs.writeFile(resolve(locksDir, "default.locks.json"), JSON.stringify({ version: 1, lockedObjects: [], updatedAt: new Date().toISOString() }, null, 0));
  }

  async function exportHtml(): Promise<string> {
    const html = exportToHtml(baseScene as any);
    const htmlPath = resolve(testDir, "export-baseline.html");
    await fs.writeFile(htmlPath, html, "utf-8");
    return htmlPath;
  }

  async function exportHtmlFromScene(scene: Record<string, unknown>): Promise<string> {
    const html = exportToHtml(scene as any);
    const htmlPath = resolve(testDir, "export-mutated.html");
    await fs.writeFile(htmlPath, html, "utf-8");
    return htmlPath;
  }

  async function takeScreenshot(pagePath: string): Promise<Buffer> {
    // This is called within a test context, page is available
    throw new Error("use takeScreenshotWithPage instead");
  }

  function diffBuffers(a: Buffer, b: Buffer): { diffPixels: number; totalPixels: number } {
    const len = Math.min(a.length, b.length);
    let diff = 0;
    for (let i = 0; i < len; i += 4) {
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) {
        diff++;
      }
    }
    return { diffPixels: diff, totalPixels: len / 4 };
  }

  test.beforeAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    await writeScene(baseScene as any);
  });

  test.afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test("baseline vs baseline: 0 px diff (same scene, two screenshots)", async ({ page }) => {
    const htmlPath = await exportHtml();
    await page.goto(`file://${htmlPath}`);
    await page.waitForTimeout(500);
    const shot1 = await page.screenshot({ fullPage: true });

    await page.reload();
    await page.waitForTimeout(500);
    const shot2 = await page.screenshot({ fullPage: true });

    const diff = diffBuffers(shot1, shot2);
    expect(diff.diffPixels).toBe(0);
  });

  test("M1: change text content -> diff > 0 px", async ({ page }) => {
    const mutated = JSON.parse(JSON.stringify(baseScene));
    (mutated.objects[objectId] as any).props.content = "Goodbye World";
    const htmlPath = await exportHtmlFromScene(mutated);
    await page.goto(`file://${htmlPath}`);
    await page.waitForTimeout(500);
    const shot = await page.screenshot({ fullPage: true });

    const baselineHtml = await exportHtml();
    await page.goto(`file://${baselineHtml}`);
    await page.waitForTimeout(500);
    const baselineShot = await page.screenshot({ fullPage: true });

    const diff = diffBuffers(baselineShot, shot);
    expect(diff.diffPixels).toBeGreaterThan(0);
  });

  test("M2: change font size -> diff > 0 px", async ({ page }) => {
    const mutated = JSON.parse(JSON.stringify(baseScene));
    (mutated.objects[objectId] as any).style = { fontSize: "32px" };
    const htmlPath = await exportHtmlFromScene(mutated);
    await page.goto(`file://${htmlPath}`);
    await page.waitForTimeout(500);
    const shot = await page.screenshot({ fullPage: true });

    const baselineHtml = await exportHtml();
    await page.goto(`file://${baselineHtml}`);
    await page.waitForTimeout(500);
    const baselineShot = await page.screenshot({ fullPage: true });

    const diff = diffBuffers(baselineShot, shot);
    expect(diff.diffPixels).toBeGreaterThan(0);
  });

  test("M3: change screen background -> diff > 0 px", async ({ page }) => {
    const mutated = JSON.parse(JSON.stringify(baseScene));
    (mutated.screens[sceneId] as any).style = { background: "#ff0000" };
    const htmlPath = await exportHtmlFromScene(mutated);
    await page.goto(`file://${htmlPath}`);
    await page.waitForTimeout(500);
    const shot = await page.screenshot({ fullPage: true });

    const baselineHtml = await exportHtml();
    await page.goto(`file://${baselineHtml}`);
    await page.waitForTimeout(500);
    const baselineShot = await page.screenshot({ fullPage: true });

    const diff = diffBuffers(baselineShot, shot);
    expect(diff.diffPixels).toBeGreaterThan(0);
  });

  test("M4: change text color -> diff > 0 px", async ({ page }) => {
    const mutated = JSON.parse(JSON.stringify(baseScene));
    (mutated.objects[objectId] as any).style = { color: "#00ff00" };
    const htmlPath = await exportHtmlFromScene(mutated);
    await page.goto(`file://${htmlPath}`);
    await page.waitForTimeout(500);
    const shot = await page.screenshot({ fullPage: true });

    const baselineHtml = await exportHtml();
    await page.goto(`file://${baselineHtml}`);
    await page.waitForTimeout(500);
    const baselineShot = await page.screenshot({ fullPage: true });

    const diff = diffBuffers(baselineShot, shot);
    expect(diff.diffPixels).toBeGreaterThan(0);
  });

  test("M5: change object style background color -> diff > 0 px", async ({ page }) => {
    const mutated = JSON.parse(JSON.stringify(baseScene));
    (mutated.objects[objectId] as any).style = { background: "#ff0000" };
    const htmlPath = await exportHtmlFromScene(mutated);
    await page.goto(`file://${htmlPath}`);
    await page.waitForTimeout(500);
    const shot = await page.screenshot({ fullPage: true });

    const baselineHtml = await exportHtml();
    await page.goto(`file://${baselineHtml}`);
    await page.waitForTimeout(500);
    const baselineShot = await page.screenshot({ fullPage: true });

    const diff = diffBuffers(baselineShot, shot);
    expect(diff.diffPixels).toBeGreaterThan(0);
  });
});
