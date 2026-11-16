import { Scene } from "@intent/schema";
import { createHash } from "node:crypto";
import { validateScene } from "@intent/schema";
import {
  escapeHtml,
  renderExportCss,
  renderStateCss,
  renderResponsiveCss,
  renderModelNodeHtml,
  normalizeSceneToModel,
  expandComponentInstances,
  DEFAULT_BREAKPOINTS,
} from "@intent/engine";
import type { Breakpoints } from "@intent/schema";

// S-1-11 / AC-M1-07: the Studio preview renderer.
//
// Deliberately separate from the exporter (`exportToHtml`) at the document and
// markup level: the exporter is a product deliverable (a static file); the
// preview is a live, interactive surface rendered inside a sandboxed iframe.
// They share the *same RenderModel* and the *same stylesheet text*, so the
// fidelity comparison (trd 13.8) compares two renderings of one source of
// truth — structural equivalence, not coincidental agreement.

const PREVIEW_EXTRAS = `
  /* height: 100% (definite) so the .intent-screen child's min-height: 100% resolves against it,
     matching how the exported file fills the viewport */
  main.preview-root { display: flex; flex-direction: column; height: 100%; min-height: 100%; }
  [data-state="hover"]:hover { outline: 2px dashed #0066cc; outline-offset: 2px; }
  /* Selection outline drawn by the preview runtime on { t: "select" } (Studio shell draws the overlay;
     this is the base signal inside the document) */
  [data-selected="true"] { outline: 2px solid #5b8cff; outline-offset: 1px; }
`;

// Studio ↔ preview protocol (trd 12.2, M1 subset). The preview is sandboxed with
// opaque origin ("allow-scripts" only), so event.origin carries no information;
// the shell and the preview both validate messages by channel id.
const RUNTIME_SCRIPT = `
(function() {
  var channel = null;
  var raf = 0;
  var hoverTarget = null;

  function directPost(msg) {
    window.parent.postMessage(msg, "*");
  }
  function post(msg) {
    if (!channel) return;
    msg.channel = channel;
    directPost(msg);
  }

  window.addEventListener("message", function(event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || typeof msg !== "object" || typeof msg.t !== "string") return;
    if (msg.t === "init" && typeof msg.channel === "string") {
      channel = msg.channel;
      return;
    }
    if (msg.channel !== channel) return;
    if (msg.t === "select") {
      var ids = Array.isArray(msg.ids) ? msg.ids : [];
      var rects = {};
      var nodes = document.querySelectorAll("[data-object-id]");
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        var id = el.getAttribute("data-object-id") || "";
        var on = ids.indexOf(id) !== -1;
        if (on) {
          el.setAttribute("data-selected", "true");
          var r = el.getBoundingClientRect();
          rects[id] = { x: r.left, y: r.top, w: r.width, h: r.height };
        } else if (el.getAttribute("data-selected") === "true") {
          el.setAttribute("data-selected", "false");
        }
      }
      post({ t: "bounds", rects: rects });
    } else if (msg.t === "mode") {
      document.documentElement.setAttribute("data-mode", msg.mode === "preview" ? "preview" : "edit");
    } else if (msg.t === "forceState") {
      // Inspector "force state" (trd 5.3): toggle data-state on the target.
      var forcedId = typeof msg.id === "string" ? msg.id : "";
      var state = typeof msg.state === "string" && /^[a-z]+$/.test(msg.state) ? msg.state : "";
      var nodes = document.querySelectorAll("[data-object-id]");
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.getAttribute("data-object-id") === forcedId) {
          if (state) {
            el.setAttribute("data-state", state);
          } else {
            el.removeAttribute("data-state");
          }
        }
      }
      post({ t: "stateForced", id: forcedId, state: state });
    }
  });

  document.addEventListener("click", function(e) {
    var t = e.target;
    var el = t && t.closest ? t.closest("[data-object-id]") : null;
    if (!el) return;
    e.preventDefault();
    post({ t: "click", id: el.getAttribute("data-object-id") || "" });
  }, true);

  document.addEventListener("mousemove", function(e) {
    var t = e.target;
    hoverTarget = t && t.closest ? t.closest("[data-object-id]") : null;
    if (raf) return;
    raf = requestAnimationFrame(function() {
      raf = 0;
      var id = hoverTarget ? (hoverTarget.getAttribute && hoverTarget.getAttribute("data-object-id")) : null;
      post({ t: "hover", id: id });
    });
  }, true);

  // Announce load so the shell can issue init with the channel id.
  directPost({ t: "ready" });
})();
`;

// The two inline scripts are CONSTANT strings (no scene data is embedded), so both
// the shell CSP (parent) and the srcdoc CSP (child) can allow exactly these two
// scripts by sha256 hash. about:srcdoc inherits the parent policy, so a per-call
// nonce in the child meta alone would never work — hashes work in both policies.
const FOCUS_SCRIPT = `(function() {
  var first = document.querySelector('[data-screen-id]');
  if (first && typeof first.querySelector === 'function') {
    var focusable = first.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.setAttribute('tabindex', '0');
  }
})();`;

/** The sha256 CSP sources for the two constant inline scripts. */
export function previewScriptHashes(): string[] {
  return [FOCUS_SCRIPT, RUNTIME_SCRIPT].map(
    (body) => `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`,
  );
}

const PREVIEW_SCRIPT_HASHES = previewScriptHashes().join(" ");

/** Builds the sandboxed preview document for an iframe srcdoc.
 *  The CSP meta allows exactly the two constant inline scripts (sha256 sources) plus inline styles. */
export function buildPreviewDocument(scene: Scene, options: { breakpoints?: Breakpoints } = {}): string {
  const validated = validateScene(scene);
  const renderScene = expandComponentInstances(validated);
  const breakpoints = options.breakpoints ?? DEFAULT_BREAKPOINTS;
  const model = normalizeSceneToModel(validated, { breakpoints });

  const stateCss = renderStateCss(renderScene);
  const responsiveCss = renderResponsiveCss(renderScene, breakpoints);
  const body = model.screens
    .map((screen) => renderModelNodeHtml(screen.root, 0, { remaining: 5000 }, true))
    .join("\n");
  const csp =
    `default-src 'none'; script-src ${PREVIEW_SCRIPT_HASHES}; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`;
  const styles = [renderExportCss(), PREVIEW_EXTRAS];
  if (stateCss) styles.push(stateCss);
  if (responsiveCss) styles.push(responsiveCss);
  const stylesBlock = styles.map((s) => `<style>${s}</style>`).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<title>${escapeHtml(scene.metadata.name ?? "Preview")}</title>
${stylesBlock}
</head>
<body>
<main class="preview-root" id="preview-root">
${body}
</main>
<script>${FOCUS_SCRIPT}</script>
<script>${RUNTIME_SCRIPT}</script>
</body>
</html>`;
}
