import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { exportToHtml } from "../packages/engine/dist/index.js";

// Visual differential test (S-1-13, docs/test.md 7.2 companion).
// Proves the screenshot-comparison machinery itself is real:
//   1. Same scene, two captures → 0 differing pixels.
//   2. Known one-sided mutations → comparison must report a mismatch.
// Unlike the previous revision of this file, comparison is actual pixel
// comparison via Playwright's screenshot matcher with 0 tolerance — not a
// byte count of the compressed PNG payloads.

const THRESHOLD = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests", "visual", "threshold.json"), "utf-8"),
) as { maxDiffPixels: number; threshold: number };

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

test.use({ deviceScaleFactor: 1, locale: "en-US", timezoneId: "UTC", reducedMotion: "reduce" });

test.describe("Visual differential test (S-1-13)", () => {
  const tmpDir = resolve(process.cwd(), ".test-visual-diff");
  const snapshotParent = resolve(process.cwd(), "tests", "visual-diff.spec.ts-snapshots");

  test.beforeAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(tmpDir, { recursive: true });
  });

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.rm(snapshotParent, { recursive: true, force: true });
  });

  async function writeExport(name: string, scene: Record<string, unknown>) {
    const htmlPath = resolve(tmpDir, `${name}.html`);
    await fs.writeFile(htmlPath, exportToHtml(scene as any), "utf-8");
    return htmlPath;
  }

  async function captureScreen(page: import("@playwright/test").Page) {
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () =>
        new Promise<void>((res) => {
          requestAnimationFrame(() => requestAnimationFrame(() => res()));
        }),
    );
    return page.locator(".intent-screen").first().screenshot();
  }

  async function writeSnapshot(testInfo: import("@playwright/test").TestInfo, name: string, buf: Buffer) {
    const target = testInfo.snapshotPath(name);
    await fs.mkdir(dirname(target), { recursive: true });
    await fs.writeFile(target, buf);
  }

  test("baseline vs baseline: 0 px diff (same scene, two captures)", async ({ page }, testInfo) => {
    const htmlPath = await writeExport("baseline", baseScene as any);
    await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`);
    const first = await captureScreen(page);
    await writeSnapshot(testInfo, "visual-diff-baseline.png", first);

    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () =>
        new Promise<void>((res) => {
          requestAnimationFrame(() => requestAnimationFrame(() => res()));
        }),
    );
    await expect(page.locator(".intent-screen").first()).toHaveScreenshot("visual-diff-baseline.png", {
      maxDiffPixels: THRESHOLD.maxDiffPixels,
      threshold: THRESHOLD.threshold,
      animations: "disabled",
    });
  });

  const mutations: Array<{ name: string; apply: (scene: Record<string, unknown>) => Record<string, unknown> }> = [
    {
      name: "text content change",
      apply: (scene) => {
        const mutated = structuredClone(scene) as any;
        mutated.objects[objectId].props.content = "Goodbye World";
        return mutated;
      },
    },
    {
      name: "font size change",
      apply: (scene) => {
        const mutated = structuredClone(scene) as any;
        mutated.objects[objectId].style = { fontSize: "32px" };
        return mutated;
      },
    },
    {
      name: "screen background change",
      apply: (scene) => {
        const mutated = structuredClone(scene) as any;
        mutated.screens[sceneId].style = { background: "#ff0000" };
        return mutated;
      },
    },
    {
      name: "text color change",
      apply: (scene) => {
        const mutated = structuredClone(scene) as any;
        mutated.objects[objectId].style = { color: "#00ff00" };
        return mutated;
      },
    },
    {
      name: "object background change",
      apply: (scene) => {
        const mutated = structuredClone(scene) as any;
        mutated.objects[objectId].style = { background: "#ff0000" };
        return mutated;
      },
    },
  ];

  for (const mutation of mutations) {
    test(`${mutation.name} — comparison must fail`, async ({ page }, testInfo) => {
      const baselinePath = await writeExport(`baseline-${mutation.name.replace(/\s+/g, "-")}`, baseScene as any);
      await page.goto(`file:///${baselinePath.replace(/\\/g, "/")}`);
      const shot = await captureScreen(page);
      const snapshotName = `visual-diff-${mutation.name.replace(/\s+/g, "-")}.png`;
      await writeSnapshot(testInfo, snapshotName, shot);

      const mutatedPath = await writeExport(`mutated-${mutation.name.replace(/\s+/g, "-")}`, mutation.apply(baseScene as any));
      await page.goto(`file:///${mutatedPath.replace(/\\/g, "/")}`);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(
        () =>
          new Promise<void>((res) => {
            requestAnimationFrame(() => requestAnimationFrame(() => res()));
          }),
      );

      let detected = false;
      try {
        await expect(page.locator(".intent-screen").first()).toHaveScreenshot(snapshotName, {
          maxDiffPixels: THRESHOLD.maxDiffPixels,
          threshold: THRESHOLD.threshold,
          animations: "disabled",
        });
      } catch {
        detected = true;
      }
      expect(detected).toBe(true);
    });
  }
});
