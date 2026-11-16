import { Scene, SceneObject } from "@intent/schema";
import { createHash } from "node:crypto";
import { IntentError, ErrorCodes } from "@intent/core";
import {
  escapeHtml,
  safeClassToken,
  sanitizeUrl,
  renderExportCss,
  buildStyleString,
  renderIconMarkup,
  renderStateCss,
  renderResponsiveCss,
  DEFAULT_BREAKPOINTS,
} from "@intent/engine";
import type { Breakpoints } from "@intent/schema";

// S-1-11 / AC-M1-07: the Studio preview renderer.
//
// Deliberately separate from the exporter (`exportToHtml`) at the document and
// markup level: the exporter is a product deliverable (a static file); the
// preview is a live, interactive surface rendered inside a sandboxed iframe.
// Both sides intentionally share the exact same CSS text and the same
// inline-style builder (via `renderExportCss` / `buildStyleString` from
// @intent/engine), so the preview renders the scene with the same stylesheet
// the export ships. That is what makes the AC-M1-07 pixel comparison
// meaningful (trd 13.8): same scene, same content, same fonts — same pixels.

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

// Renders are bounded: a corrupt/hostile scene graph can never blow the stack or
// the output (a cyclic scene would otherwise recurse forever).
const MAX_DEPTH = 200;
const MAX_NODES = 5000;

function renderNode(obj: SceneObject, all: Record<string, SceneObject>, depth = 0, budget = { remaining: MAX_NODES }): string {
  if (depth > MAX_DEPTH || budget.remaining <= 0) {
    throw new IntentError(ErrorCodes.E_LIMIT, "Scene exceeds preview render depth/size budget");
  }
  budget.remaining -= 1;
  const pad = "  ".repeat(depth);
  const children = obj.children
    .map((id) => {
      const child = all[id];
      if (!child) {
        return `${pad}  <!-- missing child ${String(id).replace(/[^A-Za-z0-9_-]/g, "?")} -->`;
      }
      return renderNode(child, all, depth + 1, budget);
    })
    .join("\n");

  const style = buildStyleString(obj.style);
  const styleAttr = style ? ` style="${escapeHtml(style)}"` : "";

  switch (obj.type) {
    case "screen":
      return `${pad}<main id="s-${escapeHtml(obj.id)}" class="intent-screen"${styleAttr} data-screen-id="${escapeHtml(obj.id)}">\n${children}\n${pad}</main>`;
    case "container":
      return `${pad}<div class="intent-container"${styleAttr} data-object-id="${escapeHtml(obj.id)}">\n${children}\n${pad}</div>`;
    case "text": {
      const content = escapeHtml((obj.props.content as string) ?? "");
      return `${pad}<p class="intent-text"${styleAttr} data-object-id="${escapeHtml(obj.id)}">${content}</p>`;
    }
    case "button": {
      const label = escapeHtml((obj.props.label as string) ?? "Button");
      const variant = safeClassToken(obj.props.variant, "primary");
      const disabled = obj.props.disabled ? " disabled" : "";
      return `${pad}<button class="intent-button intent-button-${variant}"${styleAttr}${disabled} data-object-id="${escapeHtml(obj.id)}" type="button">${label}</button>`;
    }
    case "input": {
      const placeholder = escapeHtml((obj.props.placeholder as string) ?? "");
      const required = obj.props.required ? " required" : "";
      const disabled = obj.props.disabled ? " disabled" : "";
      const rawType = typeof obj.props.type === "string" ? obj.props.type : "text";
      const type = ["text", "email", "password", "number", "tel", "url"].includes(rawType) ? rawType : "text";
      return `${pad}<input class="intent-input" type="${type}" placeholder="${placeholder}"${styleAttr}${required}${disabled} data-object-id="${escapeHtml(obj.id)}" aria-label="${placeholder}" />`;
    }
    case "image": {
      const src = escapeHtml(sanitizeUrl(obj.props.src));
      const alt = escapeHtml((obj.props.alt as string) ?? "");
      const fit = safeClassToken(obj.props.fit, "cover");
      return `${pad}<img class="intent-image intent-fit-${fit}" src="${src}" alt="${alt}"${styleAttr} data-object-id="${escapeHtml(obj.id)}" />`;
    }
    case "checkbox": {
      const label = escapeHtml((obj.props.label as string) ?? "Checkbox");
      const checked = obj.props.checked ? " checked" : "";
      const disabled = obj.props.disabled ? " disabled" : "";
      const name = typeof obj.props.name === "string" && obj.props.name ? ` name="${escapeHtml(obj.props.name)}"` : "";
      return `${pad}<label class="intent-checkbox"${styleAttr} data-object-id="${escapeHtml(obj.id)}"><input type="checkbox"${name}${checked}${disabled} /><span>${label}</span></label>`;
    }
    case "radio": {
      const label = escapeHtml((obj.props.label as string) ?? "Option");
      const checked = obj.props.checked ? " checked" : "";
      const disabled = obj.props.disabled ? " disabled" : "";
      const name = typeof obj.props.name === "string" && obj.props.name ? ` name="${escapeHtml(obj.props.name)}"` : "";
      const value = typeof obj.props.value === "string" && obj.props.value ? ` value="${escapeHtml(obj.props.value)}"` : "";
      return `${pad}<label class="intent-radio"${styleAttr} data-object-id="${escapeHtml(obj.id)}"><input type="radio"${name}${value}${checked}${disabled} /><span>${label}</span></label>`;
    }
    case "switch": {
      const label = escapeHtml((obj.props.label as string) ?? "Toggle");
      const checked = obj.props.checked ? " checked" : "";
      const disabled = obj.props.disabled ? " disabled" : "";
      const name = typeof obj.props.name === "string" && obj.props.name ? ` name="${escapeHtml(obj.props.name)}"` : "";
      return `${pad}<label class="intent-switch"${styleAttr} data-object-id="${escapeHtml(obj.id)}"><input type="checkbox" role="switch"${name}${checked}${disabled} /><span class="switch-track"></span><span>${label}</span></label>`;
    }
    case "link": {
      const label = escapeHtml((obj.props.label as string) ?? "Link");
      const href = sanitizeUrl(obj.props.href);
      const target = safeClassToken(obj.props.target, "_self");
      const targetAttr = target === "_self" ? "" : ` target="${target}"`;
      const SAFE_REL = new Set(["noopener", "noreferrer", "nofollow"]);
      const rawRel = typeof obj.props.rel === "string" ? obj.props.rel : "";
      const rels = rawRel.split(/\s+/).filter((t) => SAFE_REL.has(t));
      if (target === "_blank" && !rels.includes("noopener")) rels.push("noopener");
      const relAttr = rels.length ? ` rel="${rels.join(" ")}"` : "";
      const hrefAttr = href ? ` href="${escapeHtml(href)}"` : "";
      return `${pad}<a class="intent-link"${hrefAttr}${targetAttr}${relAttr}${styleAttr} data-object-id="${escapeHtml(obj.id)}">${label}</a>`;
    }
    case "list": {
      const items = Array.isArray(obj.props.items) ? (obj.props.items as string[]) : [];
      const ordered = obj.props.ordered === true;
      const tag = ordered ? "ol" : "ul";
      const lis = items.map((item) => `${pad}  <li>${escapeHtml(item)}</li>`).join("\n");
      return `${pad}<${tag} class="intent-list"${styleAttr} data-object-id="${escapeHtml(obj.id)}">\n${lis}\n${pad}</${tag}>`;
    }
    case "modal": {
      const title = escapeHtml((obj.props.title as string) ?? "");
      const size = safeClassToken(obj.props.size, "md");
      const modalClass = size === "md" ? "intent-modal" : `intent-modal intent-modal-${size}`;
      const openAttr = obj.props.open ? " open" : "";
      const titleHtml = title ? `\n${pad}  <h2 class="intent-modal-title">${title}</h2>` : "";
      return `${pad}<dialog class="${modalClass}"${openAttr}${styleAttr} data-object-id="${escapeHtml(obj.id)}">${titleHtml}\n${children}\n${pad}</dialog>`;
    }
    case "icon":
      return `${pad}${renderIconMarkup(obj.props.icon, obj.props.size, obj.props.color, obj.props.label, { objectId: obj.id, styleAttr })}`;
    case "divider": {
      const direction = obj.props.direction === "vertical" ? "vertical" : "horizontal";
      const thicknessRaw = typeof obj.props.thickness === "number" && Number.isFinite(obj.props.thickness) ? obj.props.thickness : 1;
      const thickness = Math.min(Math.max(Math.floor(thicknessRaw), 1), 32);
      const base = buildStyleString(obj.style);
      const dimension = direction === "horizontal" ? `height: ${thickness}px;` : `width: ${thickness}px;`;
      const merged = [base, dimension].filter(Boolean).join(" ").trim();
      const mergedAttr = merged ? ` style="${escapeHtml(merged)}"` : "";
      return `${pad}<hr class="intent-divider intent-divider-${direction}" role="separator"${mergedAttr} data-object-id="${escapeHtml(obj.id)}" />`;
    }
    default:
      return `${pad}<div${styleAttr} data-object-id="${escapeHtml(obj.id)}">\n${children}\n${pad}</div>`;
  }
}

/** Builds the sandboxed preview document for an iframe srcdoc.
 *  The CSP meta allows exactly the two constant inline scripts (sha256 sources) plus inline styles. */
export function buildPreviewDocument(scene: Scene, options: { breakpoints?: Breakpoints } = {}): string {
  const breakpoints = options.breakpoints ?? DEFAULT_BREAKPOINTS;
  const csp =
    `default-src 'none'; script-src ${PREVIEW_SCRIPT_HASHES}; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`;
  const screenIds = Object.keys(scene.screens);
  const ordered = scene.screenOrder.filter((id) => scene.screens[id]);
  const rest = screenIds.filter((id) => !ordered.includes(id));
  const ids = [...ordered, ...rest];
  const all = scene.objects;

  const stateCss = renderStateCss(scene);
  const responsiveCss = renderResponsiveCss(scene, breakpoints);
  const body = ids
    .map((id) => {
      const screen = scene.screens[id];
      if (!screen) return "";
      return renderNode(screen, all);
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<title>${escapeHtml(scene.metadata.name ?? "Preview")}</title>
<style>${renderExportCss()}</style>
<style>${PREVIEW_EXTRAS}</style>
${stateCss ? `<style>${stateCss}</style>` : ""}${responsiveCss ? `<style>${responsiveCss}</style>` : ""}
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
