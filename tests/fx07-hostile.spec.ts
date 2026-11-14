import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { exportToHtml } from "../packages/engine/dist/index.js";
import { validateScene } from "../packages/schema/dist/index.js";

// FX-07 (docs/test.md fixture catalog / TC-ENG-04): hostile scene through export.
// The fixture's props and metadata carry script tags, javascript: URLs, style-breakout
// sequences, quote breakouts and markup-injection payloads in every rendered position.
//
// The export embeds the scene in a <script> as inert JSON data (window.__INTENT_SCENE__).
// User payloads legitimately appear there as \u003C-escaped string values — they are data,
// not markup. Assertions are therefore split:
//   markup  — everything outside the __INTENT_SCENE__ data block: user payloads must not
//             survive here in any executable or attribute-breaking form
//   data    — the JSON carriage: must contain no </script> terminator and no unescaped markup

const scenePath = resolve(process.cwd(), "tests", "fixtures", "fx-07-hostile.json");
const scene = JSON.parse(readFileSync(scenePath, "utf-8")) as Record<string, unknown>;
const html = exportToHtml(scene as any);

const dStart = html.indexOf("window.__INTENT_SCENE__");
const dEnd = html.indexOf("</script>", dStart);
const dataBlock = html.slice(dStart, dEnd);
const markup = html.slice(0, dStart) + html.slice(dEnd);

test.describe("FX-07 hostile scene — through export", () => {
  test("fixture is schema-valid (payloads must survive validation to reach the exporter)", () => {
    expect(() => validateScene(scene)).not.toThrow();
  });

  test("exactly the 2 legitimate script blocks, 2 style blocks and 1 title pair are emitted", () => {
    expect(html.split("<script").length - 1).toBe(2);
    expect(html.split("</script>").length - 1).toBe(2);
    expect(html.split("</style>").length - 1).toBe(2);
    expect(html.split("<title>").length - 1).toBe(1);
    expect(html.split("</title>").length - 1).toBe(1);
  });

  test("__INTENT_SCENE__ data block carries user payloads inert (escaped, no </script>)", () => {
    expect(dataBlock).not.toContain("</script>");
    expect(dataBlock).not.toMatch(/<\s*script/i); // no literal markup from user data
    expect(dataBlock).toContain("\\u003cscript"); // user tags are \u003C-escaped
  });

  test("rendered markup: no javascript: URL, no external URL, no @import, no url()", () => {
    expect(/javascript\s*:/i.test(markup)).toBe(false);
    expect(/vbscript\s*:/i.test(markup)).toBe(false);
    expect(markup).not.toMatch(/https?:\/\//i);
    expect(markup).not.toContain("evil.example");
    expect(markup).not.toContain("@import");
    expect(markup).not.toMatch(/url\(/i);
    expect(markup).not.toContain("image/svg+xml"); // svg data-URI blocked by MIME allowlist
  });

  test("rendered markup: user payloads do not appear as markup", () => {
    expect(markup).not.toContain("<script>alert");
    expect(markup).not.toContain("</button><script>");
    expect(markup).not.toContain("</style><script>");
    expect(markup).not.toContain("</title><script>");
    expect(markup).not.toContain("url(javascript:alert");
    expect(markup).not.toContain("-moz-binding:url(javascript");
    expect(markup).not.toMatch(/onerror\s*=\s*["']/i); // the escaped alt text "onerror=alert(…)" is inert text, never an attribute
    expect(markup).not.toContain("onclick=");
  });

  test("javascript: image src is dropped; external image src is dropped", () => {
    const imgTags = markup.match(/<img[^>]*>/g) ?? [];
    expect(imgTags.length).toBeGreaterThanOrEqual(2);
    for (const tag of imgTags) {
      expect(tag).not.toMatch(/src\s*=\s*["']?\s*javascript/i);
      expect(tag).not.toMatch(/https?:\/\//i);
    }
  });

  test("quote breakout in attribute values is neutralized (escapeHtml emits &quot;)", () => {
    // the placeholder payload tries to close the attribute and inject onfocus
    expect(markup).not.toContain('onfocus="alert');
    expect(markup).not.toMatch(/placeholder="" autofocus/);
    expect(markup).toContain("&quot;"); // placeholder payload is &quot;-escaped inside the attribute
  });

  test("no external event handler attributes in rendered markup", () => {
    expect(markup).not.toMatch(/\son\w+\s*=\s*["']/i);
  });

  test("browser opens the export: no dialogs, no page errors, zero external requests, visible content intact", async ({ page }) => {
    const tmpDir = resolve(process.cwd(), ".test-fx07");
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(tmpDir, { recursive: true });
    const out = resolve(tmpDir, "fx-07-export.html");
    await fs.writeFile(out, html, "utf-8");

    const dialogs: string[] = [];
    const pageErrors: string[] = [];
    const externalRequests: string[] = [];
    page.on("dialog", (d) => {
      dialogs.push(d.message());
      void d.dismiss().catch(() => {});
    });
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    page.on("request", (req) => {
      const url = req.url();
      if (!url.startsWith("file://") && !url.startsWith("data:") && !url.startsWith("about:")) {
        externalRequests.push(url);
      }
    });

    try {
      await page.goto(`file:///${out.replace(/\\/g, "/")}`, { waitUntil: "load" });
      await page.waitForTimeout(300);

      expect(dialogs).toEqual([]);
      expect(pageErrors).toEqual([]);
      expect(externalRequests).toEqual([]);

      const text = await page.evaluate(() => document.body.innerText);
      expect(text).toContain("Booking Successful");
      expect(text).toContain("Confirm Booking");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
