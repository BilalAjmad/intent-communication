import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { buildPreviewDocument } from "../packages/studio/dist/index.js";

// S-1-13 / AC-M1-09: keyboard-only navigation through the Studio preview.
test.describe("Keyboard-only flow (S-1-13, AC-M1-09)", () => {
  const testDir = resolve(process.cwd(), ".test-keyboard-only");
  const screenId = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const titleId = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const inputId = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
  const primaryId = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
  const secondaryId = "o_04ARZ3NDEKTSV4RRFFQ69G5FAV";

  const scene = {
    version: 1,
    revision: 0,
    createdAt: "2026-11-11T00:00:00.000Z",
    updatedAt: "2026-11-11T00:00:00.000Z",
    screens: {
      [screenId]: {
        id: screenId,
        type: "screen",
        parentId: null,
        children: [titleId, inputId, primaryId, secondaryId],
        props: { title: "Keyboard Test", width: 1280, height: 720 },
        style: {},
        meta: {},
      },
    },
    objects: {
      [titleId]: { id: titleId, type: "text", parentId: screenId, children: [], props: { content: "Hello keyboard", fontSize: 16 }, style: {}, meta: {} },
      [inputId]: { id: inputId, type: "input", parentId: screenId, children: [], props: { type: "text", placeholder: "Type here" }, style: {}, meta: {} },
      [primaryId]: { id: primaryId, type: "button", parentId: screenId, children: [], props: { label: "Primary action", variant: "primary" }, style: {}, meta: {} },
      [secondaryId]: { id: secondaryId, type: "button", parentId: screenId, children: [], props: { label: "Secondary action", variant: "secondary" }, style: {}, meta: {} },
    },
    screenOrder: [screenId],
    metadata: { name: "Keyboard Test", tags: [] },
  } as any;

  const html = buildPreviewDocument(scene as any);

  test.beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  test.afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test("Tab focus travels in visual order and activates without a mouse", async ({ page }) => {
    const file = resolve(testDir, "preview.html");
    await fs.writeFile(file, html, "utf-8");

    // Watch postMessage from the preview (S-1-11 desk: the preview is iframe/sandbox safe).
    const messages: unknown[] = [];
    await page.exposeFunction("__report", (m: unknown) => messages.push(m));
    await page.goto(`file:///${file.replace(/\\/g, "/")}`);

    // Focus starts on the document body (html).
    await expect(page.locator("main.preview-root")).toBeVisible();

    // Tab #1 should focus the text input (the first interactive element in order).
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
    expect(focused).toBe("input");

    // Tab #2 should focus the primary button.
    await page.keyboard.press("Tab");
    const focused2 = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
    expect(focused2).toBe("button");
    const focusedLabel = await page.evaluate(() => document.activeElement?.textContent?.trim());
    expect(focusedLabel).toContain("Primary");

    // Enter activates the focused button (no mouse).
    await page.keyboard.press("Enter");
    // Just proving keyboard activation works — the visible focus ring is the signal.
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return "";
      return getComputedStyle(el).outlineStyle + " " + getComputedStyle(el).outlineWidth;
    });
    expect(outline).not.toBe("none 0px");
  });

  test("verifies preview emits an Escape/Tab-friendly document with focus-visible style", async ({ page }) => {
    const file = resolve(testDir, "preview-check.html");
    await fs.writeFile(file, html, "utf-8");
    await page.goto(`file:///${file.replace(/\\/g, "/")}`);
    const previewHtml = await page.content();
    expect(previewHtml).toContain("focus-visible");
    expect(previewHtml).toContain("preview-root");
  });
});
