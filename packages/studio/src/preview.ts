import { Scene, SceneObject } from "@intent/schema";
import { escapeHtml, sanitizeCssValue, sanitizeUrl, safeClassToken } from "@intent/engine";

// S-1-11 / AC-M1-07: the Studio preview renderer.
//
// This is deliberately separate from the exporter (`exportToHtml`). The exporter
// is a product deliverable (a static file); the preview is a live, interactive
// surface rendered inside a sandboxed iframe. They share the same scene data but
// not the same document.

const STYLE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main.preview-root { display: flex; flex-direction: column; min-height: 100%; }
  .intent-screen { display: flex; flex-direction: column; min-height: 100%; padding: 24px; gap: 12px; }
  .intent-container { display: flex; gap: 12px; align-items: stretch; }
  .intent-container[style*="direction: column"] { flex-direction: column; }
  .intent-text { font-size: 16px; line-height: 1.5; color: #212529; }
  .intent-button { border: none; cursor: pointer; padding: 12px 16px; border-radius: 6px; min-width: 44px; min-height: 44px; background: #0066cc; color: #fff; font-size: 14px; }
  .intent-button-primary:hover { background: #0052a3; }
  .intent-button-destructive { background: #dc3545; }
  .intent-button-secondary { background: #6c757d; }
  .intent-input { padding: 10px 12px; border: 1px solid #dee2e6; border-radius: 6px; min-height: 44px; font-size: 14px; }
  .intent-image { max-width: 100%; height: auto; display: block; }
  [data-state="hover"]:hover { outline: 2px dashed #0066cc; outline-offset: 2px; }
  :focus-visible { outline: 3px solid #0066cc; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;

function renderNode(obj: SceneObject, all: Record<string, SceneObject>, depth = 0): string {
  const pad = "  ".repeat(depth);
  const children = obj.children
    .map((id) => all[id])
    .filter((c): c is SceneObject => Boolean(c))
    .map((c) => renderNode(c, all, depth + 1))
    .join("\n");

  const style = buildInlineStyle(obj.style);
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

function buildInlineStyle(style: Record<string, unknown>): string {
  const out: string[] = [];
  for (const [rawKey, value] of Object.entries(style)) {
    const key = String(rawKey).replace(/([A-Z])/g, "-$1").toLowerCase();
    const parts: string[] = [];
    if (typeof value === "string") parts.push(value);
    else if (typeof value === "number") parts.push(`${value}px`);
    for (const part of parts) {
      const safe = sanitizeCssValue(part);
      if (safe) out.push(`${key}: ${safe};`);
    }
  }
  return out.join(" ");
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
<style>${STYLE}</style>
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
