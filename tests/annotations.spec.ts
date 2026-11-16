import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// Pencil annotations end to end (trd 9.7): draw on the overlay canvas → saved
// as an open annotation → attached to a feedback patch → sent → flipped to sent.
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BUTTON = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";

const scene = {
  version: 1,
  revision: 1,
  createdAt: "2026-11-16T00:00:00.000Z",
  updatedAt: "2026-11-16T00:00:00.000Z",
  screens: {
    [SCREEN]: {
      id: SCREEN,
      type: "screen",
      parentId: null,
      children: [TEXT, BUTTON],
      props: { title: "Annotate me", width: 1280, height: 720 },
      style: {},
      meta: {},
    },
  },
  objects: {
    [SCREEN]: {
      id: SCREEN,
      type: "screen",
      parentId: null,
      children: [TEXT, BUTTON],
      props: { title: "Annotate me", width: 1280, height: 720 },
      style: {},
      meta: {},
    },
    [TEXT]: { id: TEXT, type: "text", parentId: SCREEN, children: [], props: { content: "Hello" }, style: {}, meta: {} },
    [BUTTON]: { id: BUTTON, type: "button", parentId: SCREEN, children: [], props: { label: "Ship it", variant: "primary" }, style: {}, meta: {} },
  },
  screenOrder: [SCREEN],
  metadata: { name: "Annotations", tags: [] },
};

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;

test.beforeAll(async () => {
  tmpDir = resolve(os.tmpdir(), `.test-annotations-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

test("Annotate flow: draw, attach to feedback, send, annotation flips to sent", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Annotations", { timeout: 8000 });

  // Select the text object in Layers first (annotation carries the selection).
  await page.locator(".layer-item", { hasText: "text" }).first().click();

  // Enter annotate mode; the canvas overlay is visible and takes pointer events.
  await page.click("#annotate-toggle");
  await expect(page.locator("#annotate-toggle")).toHaveAttribute("aria-pressed", "true");
  const canvas = page.locator("#annotation-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x - 60, y - 30);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.move(x + 70, y + 15, { steps: 8 });
  await page.mouse.up();

  // The annotation appears in the Annotations list on the feedback tab.
  await page.click("#tab-feedback");
  await expect(page.locator(".annotation-item")).toHaveCount(1, { timeout: 8000 });

  // The annotation was stored with status open and the object id attached.
  const stored = JSON.parse(
    await fs.readFile(resolve(tmpDir, ".intent", "annotations", "default.json"), "utf-8"),
  ) as Array<{ status: string; objectId: string | null; kind: string }>;
  expect(stored).toHaveLength(1);
  expect(stored[0]?.status).toBe("open");
  expect(stored[0]?.objectId).toBe(TEXT);
  expect(stored[0]?.kind).toBe("pencil");

  // Attach it to a feedback patch and add to the queue.
  await expect(page.locator("#attach-annotations")).toBeChecked();
  await page.locator("#feedback-text").fill("See my annotation");
  await page.locator("#add-to-queue").click();
  await expect(page.locator("#toast")).toContainText("Added to the queue", { timeout: 8000 });

  // The patch queue item carries the annotation id.
  const patches = JSON.parse(
    await fs.readFile(resolve(tmpDir, ".intent", "feedback", "default.json"), "utf-8"),
  ) as Array<{ annotationIds?: string[] }>;
  expect(patches[0]?.annotationIds).toHaveLength(1);

  // Send: the annotation flips to sent and the Annotations list goes empty.
  await page.locator("#tray-toggle").click();
  await page.locator("#send-btn").click();
  await expect(page.locator("#toast")).toContainText("Sent", { timeout: 8000 });
  const sent = JSON.parse(
    await fs.readFile(resolve(tmpDir, ".intent", "annotations", "default.json"), "utf-8"),
  ) as Array<{ status: string }>;
  expect(sent[0]?.status).toBe("sent");
  await expect(page.locator("#annotations-fieldset")).toBeHidden({ timeout: 8000 });
});

test("Inspector Preview state buttons set data-state on the object in the preview iframe", async ({ page }) => {
  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Annotations", { timeout: 8000 });

  // Select the button layer; the Inspector shows the Preview state row.
  await page.locator(".layer-item", { hasText: "button" }).first().click();
  const row = page.locator(".force-state-row");
  await expect(row).toBeVisible();
  const loadingBtn = row.getByRole("button", { name: "loading" });

  // Clicking "loading" sets data-state="loading" inside the preview iframe.
  await loadingBtn.click();
  await expect(loadingBtn).toHaveAttribute("aria-pressed", "true");
  const frame = page.frameLocator("#preview-frame");
  await expect.poll(async () => frame.locator(`[data-object-id="${BUTTON}"]`).getAttribute("data-state")).toBe("loading");

  // Clicking it again clears the forced state.
  await loadingBtn.click();
  await expect(loadingBtn).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => frame.locator(`[data-object-id="${BUTTON}"]`).getAttribute("data-state")).toBeNull();
});

test("Pin flow: place a numbered pin, it lands in the annotations list, and deletes via the marker", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());

  await page.goto(`http://127.0.0.1:${port}/#t=${server.getSessionToken()}`);
  await expect(page.locator("#project-name")).toHaveText("Annotations", { timeout: 8000 });
  await page.locator(".layer-item", { hasText: "text" }).first().click();

  // Enter pin mode and drop a pin on the preview.
  await page.click("#pin-toggle");
  await expect(page.locator("#pin-toggle")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#pins-layer").click({ position: { x: 120, y: 140 } });

  // Inline editor appears; type a note and save with Enter.
  const note = page.locator(".pin-draft textarea");
  await expect(note).toBeVisible();
  await note.fill("This headline needs to be bigger");
  await note.press("Enter");

  // Pin marker appears with the number 1.
  const marker = page.locator(".pin", { hasText: "1" });
  await expect(marker).toBeVisible({ timeout: 8000 });

  // The pin landed in the Annotations list.
  await page.click("#tab-feedback");
  await expect(page.locator(".annotation-item", { hasText: "bigger" })).toBeVisible({ timeout: 8000 });

  // The annotation is stored as kind=pin in .intent/annotations/default.json.
  const stored = JSON.parse(
    await fs.readFile(resolve(tmpDir, ".intent", "annotations", "default.json"), "utf-8"),
  ) as Array<{ kind: string; text?: string; status: string }>;
  const pin = stored.find((a) => a.kind === "pin");
  expect(pin?.text).toBe("This headline needs to be bigger");
  expect(pin?.status).toBe("open");

  // Delete via the marker; the list empties.
  await marker.click();
  await expect(page.locator(".annotation-item")).toHaveCount(0, { timeout: 8000 });
});
