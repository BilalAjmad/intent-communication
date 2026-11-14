import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { exportToHtml } from "../packages/engine/dist/index.js";
import { buildPreviewDocument } from "../packages/studio/dist/index.js";

// AC-M1-07 / TC-VIS (docs/test.md 7.2):
// The Studio preview and the exported HTML must render the same pixels for the
// same scene. Differential, no stored baseline images — each test writes the
// preview capture to the comparison baseline, then requires the export capture
// to match it exactly (threshold.json: 0 differing pixels, 0 tolerance).
//
// Deliberate-failure tests (TC-VIS-02) verify the comparison can detect five
// one-sided mutations; each mutation is applied to ONE side only (the same
// mechanism viewers on the spec use for suspicious diffs), and the comparison
// must report a mismatch.

const FIXTURES = [
  "fx-01-minimal",
  "fx-02-salon",
  "fx-03-all-types",
  "fx-04-states",
  "fx-05-dark",
  "fx-06-long-text",
] as const;

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const THEMES = ["light", "dark"] as const;
const THRESHOLD = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests", "visual", "threshold.json"), "utf-8"),
) as { maxDiffPixels: number; threshold: number };

test.use({
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "UTC",
  reducedMotion: "reduce",
});

async function captureScreens(page: import("@playwright/test").Page): Promise<Buffer[]> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise<void>((res) => {
        requestAnimationFrame(() => requestAnimationFrame(() => res()));
      }),
  );
  const count = await page.locator(".intent-screen").count();
  const shots: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    shots.push(await page.locator(".intent-screen").nth(i).screenshot());
  }
  return shots;
}

async function writeSnapshot(testInfo: import("@playwright/test").TestInfo, name: string, buf: Buffer): Promise<void> {
  const target = testInfo.snapshotPath(name);
  await fs.mkdir(dirname(target), { recursive: true });
  await fs.writeFile(target, buf);
}

async function expectMatch(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
  name: string,
  index: number,
): Promise<void> {
  await expect(page.locator(".intent-screen").nth(index)).toHaveScreenshot(name, {
    maxDiffPixels: THRESHOLD.maxDiffPixels,
    threshold: THRESHOLD.threshold,
    animations: "disabled",
  });
}

test.describe("Fidelity (AC-M1-07 / TC-VIS): preview vs export, per fixture, theme, breakpoint", () => {
  const tmpDir = resolve(process.cwd(), ".test-fidelity-pixel");
  const snapshotParent = resolve(process.cwd(), "tests", "fidelity-pixel.spec.ts-snapshots");

  test.beforeAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(tmpDir, { recursive: true });
  });

  test.afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.rm(snapshotParent, { recursive: true, force: true });
  });

  for (const fixture of FIXTURES) {
    for (const theme of THEMES) {
      for (const viewport of VIEWPORTS) {
        test(`${fixture} · ${theme} · ${viewport.name}`, async ({ page }, testInfo) => {
          const scene = JSON.parse(
            await fs.readFile(resolve(process.cwd(), "tests", "fixtures", `${fixture}.json`), "utf-8"),
          );
          const exportPath = resolve(tmpDir, `${fixture}-${theme}-${viewport.name}-export.html`);
          const previewPath = resolve(tmpDir, `${fixture}-${theme}-${viewport.name}-preview.html`);
          await fs.writeFile(exportPath, exportToHtml(scene), "utf-8");
          await fs.writeFile(previewPath, buildPreviewDocument(scene), "utf-8");

          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.emulateMedia({ colorScheme: theme });

          await page.goto(`file:///${previewPath.replace(/\\/g, "/")}`);
          const previewShots = await captureScreens(page);
          expect(previewShots.length).toBeGreaterThan(0);

          await page.goto(`file:///${exportPath.replace(/\\/g, "/")}`);
          await page.evaluate(() => document.fonts.ready);
          await page.evaluate(
            () =>
              new Promise<void>((res) => {
                requestAnimationFrame(() => requestAnimationFrame(() => res()));
              }),
          );
          expect(await page.locator(".intent-screen").count()).toBe(previewShots.length);

          for (let i = 0; i < previewShots.length; i++) {
            const name = `${fixture}-${theme}-${viewport.name}-screen-${i}.png`;
            await writeSnapshot(testInfo, name, previewShots[i]);
            await expectMatch(page, testInfo, name, i);
          }
        });
      }
    }
  }

  test.describe("TC-VIS-02: deliberate failure — the comparison must detect one-sided mutations", () => {
    const MUTATION_SOURCE = "fx-02-salon";

    async function buildDocs(fixture: string) {
      const scene = JSON.parse(
        await fs.readFile(resolve(process.cwd(), "tests", "fixtures", `${fixture}.json`), "utf-8"),
      );
      const exportHtml = exportToHtml(scene);
      const previewHtml = buildPreviewDocument(scene);
      const exportPath = resolve(tmpDir, `mutation-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
      await fs.writeFile(exportPath, exportHtml, "utf-8");
      return { exportPath, previewHtml, exportHtml };
    }

    async function writePreviewDoc(name: string, html: string) {
      const p = resolve(tmpDir, name);
      await fs.writeFile(p, html, "utf-8");
      return p;
    }

    test("baseline (unmutated) matches preview — control", async ({ page }, testInfo) => {
      const scene = JSON.parse(
        await fs.readFile(resolve(process.cwd(), "tests", "fixtures", `${MUTATION_SOURCE}.json`), "utf-8"),
      );
      const previewHtml = buildPreviewDocument(scene);
      const previewPath = await writePreviewDoc("mutation-control-preview.html", previewHtml);
      const exportPath = resolve(tmpDir, "mutation-control-export.html");
      await fs.writeFile(exportPath, exportToHtml(scene), "utf-8");
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

      await page.goto(`file:///${previewPath.replace(/\\/g, "/")}`);
      const shots = await captureScreens(page);
      await writeSnapshot(testInfo, "mutation-control.png", shots[0]);

      await page.goto(`file:///${exportPath.replace(/\\/g, "/")}`);
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(
        () =>
          new Promise<void>((res) => {
            requestAnimationFrame(() => requestAnimationFrame(() => res()));
          }),
      );
      await expectMatch(page, testInfo, "mutation-control.png", 0);
    });

    const mutations: Array<{ name: string; fixture: string; apply: (html: string) => string }> = [
      {
        // margin shift is visible regardless of button width
        name: "M1 move main button by 1 px",
        fixture: "fx-02-salon",
        apply: (html) => html.replace("</style>\n</head>", ".intent-button{margin-left:1px}\n</style>\n</head>"),
      },
      {
        name: "M2 change button color by 1 level",
        fixture: "fx-02-salon",
        apply: (html) => html.replaceAll("#0066cc", "#0066cd"),
      },
      {
        name: "M3 change one character of the heading",
        fixture: "fx-02-salon",
        apply: (html) => html.replace("Salon Serenity", "Salon Serenxit"),
      },
      {
        // fx-02 screens are column flex with full-width stretched items, which hides padding deltas;
        // fx-03 has a row container where buttons are fit-content, so the change is pixel-visible
        name: "M4 spacing token 16 -> 12",
        fixture: "fx-03-all-types",
        apply: (html) => html.replaceAll("--intent-spacing-md: 16px", "--intent-spacing-md: 12px"),
      },
      {
        // the destructive-variant button only exists on screen 1 in fx-04-states; the error var swap must be visible there
        name: "M5 swap a token between preview and export path",
        fixture: "fx-04-states",
        apply: (html) => html.replace("--intent-color-error: #dc3545", "--intent-color-error: #28a745"),
      },
    ];

    for (const mutation of mutations) {
      test(`${mutation.name} — comparison must fail`, async ({ page }, testInfo) => {
        const { previewHtml } = await buildDocs(mutation.fixture);
        const baselineHtml = previewHtml;
        const mutatedHtml = mutation.apply(baselineHtml);
        expect(mutatedHtml).not.toBe(baselineHtml);
        const previewPath = await writePreviewDoc(
          `mutation-preview-${mutation.name.split(" ")[0]}-${Math.random().toString(36).slice(2)}.html`,
          baselineHtml,
        );
        const mutatedPath = await writePreviewDoc(
          `mutation-mutated-${mutation.name.split(" ")[0]}-${Math.random().toString(36).slice(2)}.html`,
          mutatedHtml,
        );
        await page.setViewportSize({ width: 390, height: 844 });
        await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

        await page.goto(`file:///${previewPath.replace(/\\/g, "/")}`);
        const shots = await captureScreens(page);
        const snapshotName = `mutation-${mutation.name.split(" ")[0]}.png`;
        await writeSnapshot(testInfo, snapshotName, shots[0]);

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
          await expectMatch(page, testInfo, snapshotName, 0);
        } catch {
          detected = true;
        }
        expect(detected).toBe(true);
      });
    }
  });
});
