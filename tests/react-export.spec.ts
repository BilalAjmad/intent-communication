import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSync } from "esbuild";
import { exportToReact, exportToHtml } from "../packages/engine/dist/index.js";

// trd 13.7/13.8 companion: the React exporter is golden-file + TS syntax
// checked; this test closes the loop on the other half — the exported React
// SOURCE FOLDER, when actually bundled and rendered, must paint the same
// pixels as the HTML export for the same scene. Not the app's golden file,
// a real end-to-end render.
//
// Scope, honestly: one text object. It proves the bundled export mounts and
// renders identically to the static export. The React export ships no App
// shell styling contract (its nav is part of the deliverable), so screens are
// compared at the CONTENT element, not the wrapper.



const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene() {
  return {
    version: 1, revision: 1, createdAt: "2026-11-16T00:00:00.000Z", updatedAt: "2026-11-16T00:00:00.000Z",
    screens: {
      [SCREEN]: { id: SCREEN, type: "screen", parentId: null, children: [TEXT], props: { title: "Home", width: 390, height: 844 }, style: {}, meta: {} },
    },
    objects: {
      [SCREEN]: { id: SCREEN, type: "screen", parentId: null, children: [TEXT], props: { title: "Home", width: 390, height: 844 }, style: {}, meta: {} },
      [TEXT]: { id: TEXT, type: "text", parentId: SCREEN, children: [], props: { content: "Hello React" }, style: { fontSize: 18 }, meta: {} },
    },
    screenOrder: [SCREEN],
    metadata: { name: "react-visual", tags: [] },
  };
}

let tmpDir: string;

test.beforeEach(async () => {
  tmpDir = resolve(process.cwd(), `.test-react-visual-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(tmpDir, { recursive: true });

  const files = exportToReact(makeScene());
  for (const [rel, content] of Object.entries(files)) {
    const target = resolve(tmpDir, rel);
    await fs.mkdir(resolve(target, ".."), { recursive: true });
    await fs.writeFile(target, content, "utf8");
  }
  await fs.writeFile(
    resolve(tmpDir, "main.tsx"),
    [
      'import { createRoot } from "react-dom/client";',
      'import App from "./intent-export/App";',
      'import "./intent-export/tokens.css";',
      'createRoot(document.getElementById("root") as HTMLElement).render(<App />);',
      "",
    ].join("\n"),
    "utf8",
  );
  await fs.writeFile(
    resolve(tmpDir, "index.html"),
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>react-export</title><style>html, body, #root { height: 100%; margin: 0; }</style><link rel="stylesheet" href="./bundle.css"></head><body><div id="root"></div><script src="./bundle.js"></script></body></html>',
    "utf8",
  );
  await fs.writeFile(resolve(tmpDir, "export.html"), exportToHtml(makeScene(), { includeDataIds: true }), "utf8");

  // Bundle the exported folder with the workspace's esbuild (devDependency of the root).
  // Use the JS API rather than execFileSync(bin/esbuild): under pnpm on Linux the
  // `bin/esbuild` shim is a shell script, and feeding it to `node` throws
  // SyntaxError — good on Windows only, not CI's ubuntu runner.
  buildSync({
    entryPoints: [resolve(tmpDir, "main.tsx")],
    bundle: true,
    jsx: "automatic",
    outfile: resolve(tmpDir, "bundle.js"),
    format: "iife",
  });
});

test.afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("React export renders the same pixels as the HTML export", async ({ page }) => {
  await page.goto(pathToFileURL(resolve(tmpDir, "index.html")).href);
  const text = page.locator(".intent-text").first();
  await expect(text).toBeVisible({ timeout: 8000 });
  await expect(text).toHaveText("Hello React");
  const reactShot = await text.screenshot();

  await page.goto(pathToFileURL(resolve(tmpDir, "export.html")).href);
  const textHtml = page.locator(".intent-text").first();
  await expect(textHtml).toBeVisible({ timeout: 8000 });
  await expect(textHtml).toHaveText("Hello React");
  const htmlShot = await textHtml.screenshot();

  // Same element, same viewport, same stylesheet text — byte-level equality is
  // expected; allow the threshold's slack for safety.
  expect(reactShot.length).toBeGreaterThan(0);
  expect(htmlShot.length).toBeGreaterThan(0);
  expect(reactShot).toEqual(htmlShot);
});
