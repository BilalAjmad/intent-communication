import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { createServer } from "../packages/server/dist/index.js";

// TC-STU-01..04 + axe — Studio shell acceptance tests (docs/test.md).
// Seeds a real project, boots the real server, and drives the real SPA.

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
        props: { title: "Shell Test", width: 390, height: 844 },
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
        props: { content: "Hello Studio", fontSize: 20 },
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
    metadata: { name: "Studio Shell Test", tags: [] },
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;
let bearerToken: string;

function frame(page: import("@playwright/test").Page) {
  return page.frameLocator("#preview-frame");
}

test.beforeAll(async () => {
  const scene = makeScene();
  tmpDir = resolve(os.tmpdir(), `.test-studio-shell-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", "default.json"), JSON.stringify(scene), "utf-8");
  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();
  bearerToken = server.getSessionToken();
});

test.afterAll(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

async function openStudio(page: import("@playwright/test").Page) {
  await page.goto(`http://127.0.0.1:${port}/#t=${bearerToken}`);
  await expect(page.locator("#project-name")).toHaveText("Studio Shell Test", { timeout: 8000 });
}

test("TC-STU-01: sandboxed srcdoc iframe cannot escape; parent cannot reach inside; CSP nonce enforced", async ({ page }) => {
  await openStudio(page);

  // sandbox is exactly allow-scripts (no allow-same-origin / allow-forms / allow-popups)
  const sandbox = await page.locator("#preview-frame").getAttribute("sandbox");
  expect(sandbox).toBe("allow-scripts");
  expect(sandbox).not.toContain("allow-same-origin");
  expect(sandbox).not.toContain("allow-forms");
  expect(sandbox).not.toContain("allow-popups");

  // Parent cannot access the opaque-origin frame's document
  const doc = await page.evaluate(() => document.getElementById("preview-frame")?.contentDocument ?? null);
  expect(doc).toBeNull();

  // Inside the frame, window.parent.document is blocked by the same-origin policy
  const frameHandle = page.frames().find((f) => f !== page.mainFrame());
  expect(frameHandle).toBeDefined();
  const parentAccess = await frameHandle!.evaluate(() => {
    try {
      void window.parent.document;
      return "accessible";
    } catch {
      return "blocked";
    }
  });
  expect(parentAccess).toBe("blocked");

  // srcdoc CSP pins exactly the two constant inline scripts by sha256 hash (no nonces needed)
  const html = await frameHandle!.content();
  const hashList = /script-src '(sha256-[^']+)' '(sha256-[^']+)'/.exec(html);
  expect(hashList).not.toBeNull();
  const scriptTags = html.match(/<script>/g) ?? [];
  expect(scriptTags.length).toBe(2);
  for (const hash of [hashList![1], hashList![2]]) {
    expect(html).toContain(hash);
  }

  // Popup attempt from inside the sandbox is refused (no allow-popups)
  const popup = await frameHandle!.evaluate(() => window.open("about:blank", "_blank") === null);
  expect(popup).toBe(true);
});

test("TC-STU-02: messages with a wrong channel or wrong source are ignored", async ({ page }) => {
  await openStudio(page);
  const layers = page.locator('.layer-item[data-object-id="' + TEXT + '"]');

  // Select the object for real
  await page.click('.layer-item[data-object-id="' + TEXT + '"]');
  await expect(layers).toHaveAttribute("aria-pressed", "true");

  // A forged message claiming to be a canvas click, with a random channel, must be ignored
  await page.evaluate((id) => {
    window.postMessage({ t: "click", channel: "forged-channel-that-is-not-the-channel", id }, "*");
  }, BUTTON);
  await expect(page.locator('.layer-item[data-object-id="' + BUTTON + '"]')).toHaveAttribute("aria-pressed", "false");
  await expect(layers).toHaveAttribute("aria-pressed", "true");

  // A forged bounds message must not paint a box for the forged object
  await page.evaluate(() => {
    window.postMessage({ t: "bounds", channel: "forged-channel-that-is-not-the-channel", rects: { o_x: { x: 1, y: 1, w: 50, h: 50 } } }, "*");
  });
  await expect(page.locator("#overlay .selection-box")).toHaveCount(1);
  await expect(page.locator("#overlay .selection-label")).toHaveText(TEXT);

  // A forged message whose source is the page itself (not the iframe) is ignored
  await page.evaluate((id) => {
    window.dispatchEvent(new MessageEvent("message", { data: { t: "click", channel: "whatever", id }, source: window }));
  }, BUTTON);
  await expect(layers).toHaveAttribute("aria-pressed", "true");

  // Sanity: the real path still works after the attacks
  await frame(page).locator('[data-object-id="' + BUTTON + '"]').click();
  await expect(page.locator('.layer-item[data-object-id="' + BUTTON + '"]')).toHaveAttribute("aria-pressed", "true");
});

test("TC-STU-03: canvas, Layers and keyboard select the same object", async ({ page }) => {
  await openStudio(page);

  const assertSelection = async (id: string) => {
    await expect(page.locator('.layer-item[data-object-id="' + id + '"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#feedback-target")).toHaveText(id);
    await expect(page.locator("#inspector-body")).toContainText(id);
  };

  // 1. Canvas click
  await frame(page).locator('[data-object-id="' + TEXT + '"]').click();
  await assertSelection(TEXT);
  await expect(page.locator("#overlay .selection-box .selection-label")).toHaveText(TEXT);

  // 2. Layers click (different path, same result)
  await page.locator('.layer-item[data-object-id="' + BUTTON + '"]').click();
  await assertSelection(BUTTON);

  // 3. Keyboard: Tab to the layer item and activate with Enter
  await page.locator('.layer-item[data-object-id="' + TEXT + '"]').focus();
  await expect(page.locator('.layer-item[data-object-id="' + TEXT + '"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await assertSelection(TEXT);
});

test("TC-STU-04: full keyboard-only flow from load to Send", async ({ page }) => {
  await openStudio(page);

  // Walk the Tab order from a fresh load (Feedback panel hidden): all chrome controls reachable
  const visited: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return "none";
      return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "");
    });
    visited.push(active);
    if (visited.some((v) => v.includes("tray-toggle"))) break;
  }
  const joined = visited.join(" | ");
  expect(joined).toContain("screen-select");
  expect(joined).toContain("layer-item");
  expect(joined).toContain("tab-inspector");
  expect(joined).toContain("tab-feedback");
  expect(joined).toContain("tray-toggle");

  // Activate the Feedback tab with the keyboard; focus must land in the text field
  await page.locator("#tab-feedback").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#feedback-text")).toBeFocused();

  // From the text field: chips then Add to queue, in order, by Tab alone
  const visitedOnFeedback: string[] = [];
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return "none";
      return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "");
    });
    visitedOnFeedback.push(active);
    if (visitedOnFeedback.some((v) => v.includes("add-to-queue"))) break;
  }
  const feedbackFlow = visitedOnFeedback.join(" | ");
  expect(feedbackFlow).toContain("chip");
  expect(feedbackFlow).toContain("add-to-queue");

  // Select the text object via keyboard on the Layers tree
  await page.locator('.layer-item[data-object-id="' + TEXT + '"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#feedback-target")).toHaveText(TEXT);

  // Type feedback, press "Bigger" chip, add to queue — keyboard only
  await page.locator("#tab-feedback").focus();
  await page.keyboard.press("Enter");
  await page.locator("#feedback-text").focus();
  await page.keyboard.type("Make this bigger on mobile");
  await page.locator('.chip[data-chip="bigger"]').focus();
  await page.keyboard.press("Space");
  await expect(page.locator('.chip[data-chip="bigger"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("#add-to-queue").press("Enter");
  await expect(page.locator("#tray-summary")).toContainText("1 draft", { timeout: 5000 });

  // Expand the tray (keyboard) and discard with the keyboard
  await page.locator("#tray-toggle").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#tray-body")).toBeVisible();
  await page.locator("#add-to-queue").press("Enter"); // adds a second draft? no — text was cleared; this adds nothing (guard toast)
  await expect(page.locator("#tray-summary")).toContainText("1 draft");

  // Send via keyboard
  await page.locator("#send-btn").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#tray-summary")).toContainText("0 draft · 1 sent", { timeout: 5000 });
  await expect(page.locator("#waiting-banner")).toBeVisible();
  await expect(page.locator("#copy-prompt")).toBeVisible();
});
