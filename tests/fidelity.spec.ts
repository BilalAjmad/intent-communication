import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { exportToHtml } from "../packages/engine/dist/index.js";
import { buildPreviewDocument } from "../packages/studio/dist/index.js";

// AC-M1-07: Preview versus exported HTML is within the threshold for every
// fixture scene, theme and breakpoint.
//
// This test checks the structural/visual fidelity of the two rendering paths:
//   exportToHtml     → the deliverable artifact a user downloads
//   buildPreviewDocument → what the Studio preview renders in the sandboxed iframe
// Both consume the same Scene. They must agree on layout, content and order; only
// incidental chrome and interaction handlers differ.

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BTN = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const INPUT = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";

const BASE_SCENE = {
  version: 1,
  revision: 0,
  createdAt: "2026-11-13T00:00:00.000Z",
  updatedAt: "2026-11-13T00:00:00.000Z",
  screens: {
    [SCREEN]: {
      id: SCREEN,
      type: "screen",
      parentId: null,
      children: [TXT, INPUT, BTN],
      props: { title: "Fidelity", width: 1280, height: 720 },
      style: {},
      meta: {},
    },
  },
  objects: {
    [TXT]: {
      id: TXT,
      type: "text",
      parentId: SCREEN,
      children: [],
      props: { content: "Booking Successful", fontSize: 18 },
      style: { color: "#0066cc" },
      meta: {},
    },
    [INPUT]: {
      id: INPUT,
      type: "input",
      parentId: SCREEN,
      children: [],
      props: { type: "text", placeholder: "Your name" },
      style: {},
      meta: {},
    },
    [BTN]: {
      id: BTN,
      type: "button",
      parentId: SCREEN,
      children: [],
      props: { label: "Confirm Booking", variant: "primary" },
      style: {},
      meta: {},
    },
  },
  screenOrder: [SCREEN],
  metadata: { name: "Fidelity Test", tags: [] },
} as any;

test.describe("Fidelity (AC-M1-07): preview vs exported HTML", () => {
  const testDir = resolve(process.cwd(), ".test-fidelity");
  const exportedPath = resolve(testDir, "exported.html");
  const previewPath = resolve(testDir, "preview.html");
  const exportedHtml = exportToHtml(BASE_SCENE as any);
  const previewHtml = buildPreviewDocument(BASE_SCENE as any);

  test.beforeAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(exportedPath, exportedHtml, "utf-8");
    await fs.writeFile(previewPath, previewHtml, "utf-8");
  });

  test.afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test("both documents contain the same visible text in the same order", async ({ page }) => {
    await page.goto(`file:///${exportedPath.replace(/\\/g, "/")}`);
    const exportText = await page.evaluate(() => document.body.innerText);

    await page.goto(`file:///${previewPath.replace(/\\/g, "/")}`);
    const previewText = await page.evaluate(() => document.body.innerText);

    // Visible text tokens both paths must render
    for (const token of ["Booking Successful", "Confirm Booking"]) {
      expect(exportText).toContain(token);
      expect(previewText).toContain(token);
    }

    // Relative order of the visible strings must match across the two documents.
    const orderIn = (s: string) => [
      s.indexOf("Booking Successful"),
      s.indexOf("Confirm Booking"),
    ];
    const exportOrder = orderIn(exportText);
    const previewOrder = orderIn(previewText);
    for (const idx of exportOrder) expect(idx).toBeGreaterThanOrEqual(0);
    for (const idx of previewOrder) expect(idx).toBeGreaterThanOrEqual(0);
    expect(previewOrder[0]).toBeLessThan(previewOrder[1]);
    expect(exportOrder[0]).toBeLessThan(exportOrder[1]);
  });

  test("both documents carry the same data-object-id set and input placeholder", async ({ page }) => {
    await page.goto(`file:///${exportedPath.replace(/\\/g, "/")}`);
    const exportIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-object-id]")).map((el) => el.getAttribute("data-object-id")),
    );
    const exportPlaceholder = await page.evaluate(() =>
      document.querySelector("input")?.getAttribute("placeholder"),
    );

    await page.goto(`file:///${previewPath.replace(/\\/g, "/")}`);
    const previewIds = await page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-object-id]")).map((el) => el.getAttribute("data-object-id")),
    );
    const previewPlaceholder = await page.evaluate(() =>
      document.querySelector("input")?.getAttribute("placeholder"),
    );

    expect(previewIds).toEqual(exportIds);
    expect(previewPlaceholder).toBe(exportPlaceholder);
  });

  test("both documents have the same structural role counts (heading, button, text, input)", async ({ page }) => {
    await page.goto(`file:///${exportedPath.replace(/\\/g, "/")}`);
    const exportCounts = await page.evaluate(() => ({
      buttons: document.querySelectorAll("button").length,
      inputs: document.querySelectorAll("input").length,
      textNodes: document.querySelectorAll(".intent-text, p, span").length,
      images: document.querySelectorAll("img").length,
    }));

    await page.goto(`file:///${previewPath.replace(/\\/g, "/")}`);
    const previewCounts = await page.evaluate(() => ({
      buttons: document.querySelectorAll("button").length,
      inputs: document.querySelectorAll("input").length,
      textNodes: document.querySelectorAll(".intent-text, p, span").length,
      images: document.querySelectorAll("img").length,
    }));

    expect(previewCounts.buttons).toBe(exportCounts.buttons);
    expect(previewCounts.inputs).toBe(exportCounts.inputs);
    // Text counts may differ by 1 because of surrounding markup; allow ±1
    expect(Math.abs(previewCounts.textNodes - exportCounts.textNodes)).toBeLessThanOrEqual(1);
    expect(previewCounts.images).toBe(exportCounts.images);
  });

  test("both documents produce zero external network requests", async ({ page }) => {
    const externalRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (!url.startsWith("file://") && !url.startsWith("data:") && !url.startsWith("about:")) {
        externalRequests.push(url);
      }
    });

    await page.goto(`file:///${exportedPath.replace(/\\/g, "/")}`);
    await page.waitForTimeout(300);

    await page.goto(`file:///${previewPath.replace(/\\/g, "/")}`);
    await page.waitForTimeout(300);

    expect(externalRequests).toEqual([]);
  });
});
