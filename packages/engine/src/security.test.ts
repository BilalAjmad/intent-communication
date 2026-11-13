import { describe, it, expect } from "vitest";
import { exportToHtml } from "./index";
import {
  escapeJsonForScript,
  sanitizeCssValue,
  sanitizeUrl,
  safeClassToken,
  buildCsp,
} from "./sanitize";
import { Scene } from "@intent/schema";

// Regression tests for the security sweep.
//
// The exported prototype HTML is opened directly by the user in a browser, so
// anything that survives the exporter runs as script in the user's origin.
// Every test below corresponds to a finding that was reproduced in a real
// Chromium instance before the fix.

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BUTTON = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const IMAGE = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const INPUT = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_04ARZ3NDEKTSV4RRFFQ69G5FAV";

/**
 * Returns the opening tag of the first element of the given type.
 *
 * Assertions must target the rendered markup, not the whole document: a
 * payload legitimately appears as inert data inside the embedded scene JSON,
 * and that is not an injection.
 */
function openingTag(html: string, tag: string): string {
  const match = new RegExp(`<${tag}\\b[^>]*>`).exec(html);
  return match ? match[0] : "";
}

function sceneWith(objects: Record<string, unknown>, children: string[]): Scene {  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN,
        type: "screen",
        parentId: null,
        children,
        props: { title: "T", width: 1280, height: 720 },
        style: {},
        meta: {},
      },
    },
    objects: objects as Scene["objects"],
    screenOrder: [SCREEN],
    metadata: { name: "Test", tags: [] },
  };
}

describe("exportToHtml: script context escaping", () => {
  it("does not let a scene value close the script element", () => {
    const scene = sceneWith(
      {
        [TEXT]: {
          id: TEXT,
          type: "text",
          parentId: SCREEN,
          children: [],
          props: { content: "</script><script>window.__PWNED__=1</script>" },
          style: {},
          meta: {},
        },
      },
      [TEXT]
    );

    const html = exportToHtml(scene);

    // The payload must not appear as a literal closing tag.
    expect(html).not.toContain("</script><script>window.__PWNED__");
    // The number of closing tags must match the number of opening tags.
    const opens = (html.match(/<script/g) || []).length;
    const closes = (html.match(/<\/script>/g) || []).length;
    expect(closes).toBe(opens);
    // The payload survives as escaped JSON data, so the scene is still complete.
    expect(html).toContain("\\u003c/script\\u003e");
  });

  it("escapes the three characters that can break out of a script block", () => {
    expect(escapeJsonForScript("</script>")).not.toContain("<");
    expect(escapeJsonForScript("a & b")).toContain("\\u0026");
    expect(escapeJsonForScript("a > b")).toContain("\\u003e");
  });

  it("keeps the embedded scene parseable as JSON", () => {
    const escaped = escapeJsonForScript(JSON.stringify({ a: "</script>", b: "x&y" }));
    expect(JSON.parse(escaped)).toEqual({ a: "</script>", b: "x&y" });
  });
});

describe("exportToHtml: attribute injection through the schema union fallback", () => {
  // SceneObjectSchema unions the typed schemas with an unconstrained
  // BaseObjectSchema, so an invalid enum value is accepted and reaches the
  // renderer. Every value interpolated into an attribute must be safe.

  it("does not emit an onclick handler from an invalid button variant", () => {
    const scene = sceneWith(
      {
        [BUTTON]: {
          id: BUTTON,
          type: "button",
          parentId: SCREEN,
          children: [],
          props: { label: "click", variant: '" onclick="window.__XSS__=1' },
          style: {},
          meta: {},
        },
      },
      [BUTTON]
    );

    const html = exportToHtml(scene);
    expect(openingTag(html, "button")).not.toContain("onclick=");
    expect(openingTag(html, "button")).toContain("intent-button-primary");
  });

  it("does not emit an onload handler from an invalid image fit", () => {
    const scene = sceneWith(
      {
        [IMAGE]: {
          id: IMAGE,
          type: "image",
          parentId: SCREEN,
          children: [],
          props: {
            src: "data:image/png;base64,iVBORw0KGgo=",
            alt: "a",
            fit: 'cover" onload="window.__XSS__=1',
          },
          style: {},
          meta: {},
        },
      },
      [IMAGE]
    );

    const html = exportToHtml(scene);
    expect(openingTag(html, "img")).not.toContain("onload=");
  });

  it("does not emit an onfocus handler from an invalid input type", () => {
    const scene = sceneWith(
      {
        [INPUT]: {
          id: INPUT,
          type: "input",
          parentId: SCREEN,
          children: [],
          props: { type: 'text" onfocus="window.__XSS__=1' },
          style: {},
          meta: {},
        },
      },
      [INPUT]
    );

    const html = exportToHtml(scene);
    expect(openingTag(html, "input")).not.toContain("onfocus=");
    expect(openingTag(html, "input")).toContain('type="text"');
  });

  it("keeps a valid enum value intact", () => {
    const scene = sceneWith(
      {
        [BUTTON]: {
          id: BUTTON,
          type: "button",
          parentId: SCREEN,
          children: [],
          props: { label: "ok", variant: "destructive" },
          style: {},
          meta: {},
        },
      },
      [BUTTON]
    );
    expect(exportToHtml(scene)).toContain("intent-button-destructive");
  });
});

describe("exportToHtml: Content-Security-Policy", () => {
  it("emits a CSP meta tag", () => {
    const html = exportToHtml(sceneWith({}, []));
    expect(html).toContain('http-equiv="Content-Security-Policy"');
  });

  it("blocks every external source by default", () => {
    const html = exportToHtml(sceneWith({}, []));
    expect(html).toContain("default-src &#039;none&#039;");
    expect(html).toContain("img-src data:");
  });

  it("adds the nonce to script-src when one is supplied", () => {
    const html = exportToHtml(sceneWith({}, []), { cspNonce: "abc123" });
    expect(html).toContain("nonce-abc123");
  });
});

describe("exportToHtml: no external URLs (trd rule 8)", () => {
  it("drops an https image source", () => {
    const scene = sceneWith(
      {
        [IMAGE]: {
          id: IMAGE,
          type: "image",
          parentId: SCREEN,
          children: [],
          props: { src: "https://evil.example.com/track.png", alt: "a", fit: "cover" },
          style: {},
          meta: {},
        },
      },
      [IMAGE]
    );
    const html = exportToHtml(scene);
    expect(html).not.toMatch(/<img[^>]*src="https:/);
  });

  it("drops a javascript: source", () => {
    const scene = sceneWith(
      {
        [IMAGE]: {
          id: IMAGE,
          type: "image",
          parentId: SCREEN,
          children: [],
          props: { src: "javascript:alert(1)", alt: "a", fit: "cover" },
          style: {},
          meta: {},
        },
      },
      [IMAGE]
    );
    expect(openingTag(exportToHtml(scene), "img")).not.toContain("javascript:");
  });

  it("keeps a data: image", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    const scene = sceneWith(
      {
        [IMAGE]: {
          id: IMAGE,
          type: "image",
          parentId: SCREEN,
          children: [],
          props: { src: png, alt: "a", fit: "cover" },
          style: {},
          meta: {},
        },
      },
      [IMAGE]
    );
    expect(exportToHtml(scene)).toContain(`src="${png}"`);
  });

  it("drops a data: URI with a non-image MIME type", () => {
    expect(sanitizeUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe("");
  });

  it("allows a fragment link and a relative path", () => {
    expect(sanitizeUrl("#s-01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe("#s-01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(sanitizeUrl("assets/logo.png")).toBe("assets/logo.png");
  });

  it("drops a relative path that escapes its directory", () => {
    expect(sanitizeUrl("../../etc/passwd")).toBe("");
  });
});

describe("exportToHtml: CSS value grammar (trd 13.2)", () => {
  it("drops a url() value", () => {
    expect(sanitizeCssValue("url(https://evil.example.com/x.png)")).toBe("");
  });

  it("drops a value containing a statement separator", () => {
    expect(sanitizeCssValue("red; background: url(x)")).toBe("");
  });

  it("keeps an ordinary value", () => {
    expect(sanitizeCssValue("var(--intent-color-primary)")).toBe("var(--intent-color-primary)");
    expect(sanitizeCssValue("#333333")).toBe("#333333");
    expect(sanitizeCssValue("calc(100% - 8px)")).toBe("calc(100% - 8px)");
  });

  it("does not emit a url() from a style value", () => {
    const scene = sceneWith(
      {
        [TEXT]: {
          id: TEXT,
          type: "text",
          parentId: SCREEN,
          children: [],
          props: { content: "x" },
          style: { background: "url(https://evil.example.com/pixel.png)" },
          meta: {},
        },
      },
      [TEXT]
    );
    expect(openingTag(exportToHtml(scene), "span")).not.toContain("evil.example.com/pixel.png");
  });
});

describe("safeClassToken", () => {
  it("keeps a safe token", () => {
    expect(safeClassToken("primary", "x")).toBe("primary");
    expect(safeClassToken("scale-down", "x")).toBe("scale-down");
  });

  it("falls back for an unsafe token", () => {
    expect(safeClassToken('a" onload="x', "cover")).toBe("cover");
    expect(safeClassToken(undefined, "cover")).toBe("cover");
  });
});

describe("buildCsp", () => {
  it("blocks everything by default", () => {
    const csp = buildCsp("");
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
  });

  it("adds the nonce to script-src when one is given", () => {
    expect(buildCsp("abc123")).toContain("script-src 'unsafe-inline' 'nonce-abc123'");
  });
});
