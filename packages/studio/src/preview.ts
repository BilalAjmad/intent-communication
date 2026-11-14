import { Scene, SceneObject } from "@intent/schema";
import {
  escapeHtml,
  safeClassToken,
  sanitizeUrl,
  renderExportCss,
  buildStyleString,
} from "@intent/engine";

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
`;

function renderNode(obj: SceneObject, all: Record<string, SceneObject>, depth = 0): string {
  const pad = "  ".repeat(depth);
  const children = obj.children
    .map((id) => all[id])
    .filter((c): c is SceneObject => Boolean(c))
    .map((c) => renderNode(c, all, depth + 1))
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
    default:
      return `${pad}<div${styleAttr} data-object-id="${escapeHtml(obj.id)}">\n${children}\n${pad}</div>`;
  }
}

/** Builds the sandboxed preview document for an iframe srcdoc. */
export function buildPreviewDocument(scene: Scene): string {
  const screenIds = Object.keys(scene.screens);
  const ordered = scene.screenOrder.filter((id) => scene.screens[id]);
  const rest = screenIds.filter((id) => !ordered.includes(id));
  const ids = [...ordered, ...rest];
  const all = scene.objects;

  const body = ids
    .map((id) => {
      const screen = scene.screens[id];
      if (!screen) return "";
      return renderNode(screen, all);
    })
    .join("\n");

  const firstId = ids[0] ?? "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml("default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; base-uri 'none'; form-action 'none'")}">
<title>${escapeHtml(scene.metadata.name ?? "Preview")}</title>
<style>${renderExportCss()}</style>
<style>${PREVIEW_EXTRAS}</style>
</head>
<body>
<main class="preview-root" id="preview-root">
${body}
</main>
<script>
  (function() {
    var first = document.getElementById(${JSON.stringify(`s-${firstId}`)});
    if (first && typeof first.setAttribute === 'function') {
      var focusable = first.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable) focusable.setAttribute('tabindex', '0');
    }
  })();
</script>
</body>
</html>`;
}
