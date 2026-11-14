import {
  Scene,
  SceneObject,
  validateScene,
  SCENE_SCHEMA_VERSION,
} from "@intent/schema";
import type { SceneValue } from "./index.js";
import {
  escapeJsonForScript,
  sanitizeCssValue,
  sanitizeUrl,
  safeClassToken,
  buildCsp,
} from "./sanitize.js";

/**
 * The exact CSS text the export emits (CSS variables + base rules), shared with
 * the Studio preview so both sides of the fidelity comparison (AC-M1-07,
 * trd 13.8) render from the same stylesheet text.
 */
export function renderExportCss(): string {
  return `${generateCssVariables()}\n${generateBaseStyles()}`;
}

export { buildStyleString };

export interface HtmlExportOptions {
  includeStyles?: boolean;
  includeScripts?: boolean;
  inlineAssets?: boolean;
  basePath?: string;
  cspNonce?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "\u0022")
    .replace(/'/g, "&#039;");
}

function tokenToCssVar(token: string): string {
  if (token.startsWith("token.color.")) {
    return `var(--intent-color-${token.slice("token.color.".length)})`;
  }
  if (token.startsWith("token.spacing.")) {
    return `var(--intent-spacing-${token.slice("token.spacing.".length)})`;
  }
  if (token.startsWith("token.typography.")) {
    return `var(--intent-typography-${token.slice("token.typography.".length)})`;
  }
  return token;
}

function resolveValue(val: SceneValue): string {
  if (typeof val === "object" && val !== null && "$type" in val && (val as { $type: string }).$type === "token") {
    return tokenToCssVar((val as { $value: string }).$value);
  }
  if (typeof val === "string") {
    return val;
  }
  if (typeof val === "number") {
    return `${val}px`;
  }
  if (typeof val === "boolean") {
    return val ? "true" : "false";
  }
  return "";
}

function buildStyleString(style: Record<string, SceneValue>): string {
  const declarations: string[] = [];
  for (const [key, val] of Object.entries(style)) {
    const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    const value = sanitizeCssValue(resolveValue(val));
    if (value) {
      declarations.push(`${cssKey}: ${value};`);
    }
  }
  return declarations.join(" ");
}

/** Input types allowed in the exported markup. */
const ALLOWED_INPUT_TYPES = new Set(["text", "email", "password", "number", "tel", "url"]);

function renderObject(obj: SceneObject, allObjects: Record<string, SceneObject>, depth: number = 0): string {
  const indent = "  ".repeat(depth);
  const styleStr = buildStyleString(obj.style);
  const styleAttr = styleStr ? ` style="${escapeHtml(styleStr)}"` : "";
  const children = obj.children.map((id) => {
    const child = allObjects[id];
    if (!child) return `<!-- missing child ${escapeHtml(id)} -->`;
    return renderObject(child, allObjects, depth + 1);
  }).join("\n");

  switch (obj.type) {
    case "screen":
      return `${indent}<div class="intent-screen" data-screen-id="${escapeHtml(obj.id)}"${styleAttr}>\n${children}\n${indent}</div>`;

    case "container":
      return `${indent}<div class="intent-container" data-object-id="${escapeHtml(obj.id)}"${styleAttr}>\n${children}\n${indent}</div>`;

    case "text": {
      const content = escapeHtml((obj.props.content as string) ?? "");
      return `${indent}<span class="intent-text" data-object-id="${escapeHtml(obj.id)}"${styleAttr}>${content}</span>`;
    }

    case "button": {
      const label = escapeHtml((obj.props.label as string) ?? "Button");
      const disabled = obj.props.disabled ? " disabled" : "";
      const variant = safeClassToken(obj.props.variant, "primary");
      return `${indent}<button class="intent-button intent-button-${variant}" data-object-id="${escapeHtml(obj.id)}"${styleAttr}${disabled}>${label}</button>`;
    }

    case "input": {
      const value = escapeHtml((obj.props.value as string) ?? "");
      const placeholder = escapeHtml((obj.props.placeholder as string) ?? "");
      const required = obj.props.required ? " required" : "";
      const disabled = obj.props.disabled ? " disabled" : "";
      const rawType = typeof obj.props.type === "string" ? obj.props.type : "text";
      const inputType = ALLOWED_INPUT_TYPES.has(rawType) ? rawType : "text";
      return `${indent}<input class="intent-input" type="${inputType}" value="${value}" placeholder="${placeholder}" data-object-id="${escapeHtml(obj.id)}"${styleAttr}${required}${disabled} />`;
    }

    case "image": {
      const src = escapeHtml(sanitizeUrl(obj.props.src));
      const alt = escapeHtml((obj.props.alt as string) ?? "");
      const fit = safeClassToken(obj.props.fit, "cover");
      return `${indent}<img class="intent-image intent-fit-${fit}" src="${src}" alt="${alt}" data-object-id="${escapeHtml(obj.id)}"${styleAttr} />`;
    }

    default:
      return `${indent}<div class="intent-object" data-object-id="${escapeHtml(obj.id)}"${styleAttr}>\n${children}\n${indent}</div>`;
  }
}

function generateCssVariables(): string {
  return `
  :root {
    /* Colors */
    --intent-color-primary: #0066cc;
    --intent-color-primaryHover: #0052a3;
    --intent-color-secondary: #6c757d;
    --intent-color-background: #ffffff;
    --intent-color-surface: #f8f9fa;
    --intent-color-text-primary: #212529;
    --intent-color-text-secondary: #6c757d;
    --intent-color-border: #dee2e6;
    --intent-color-focus: #0066cc;
    --intent-color-error: #dc3545;
    --intent-color-success: #28a745;
    --intent-color-warning: #ffc107;

    /* Spacing */
    --intent-spacing-xs: 4px;
    --intent-spacing-sm: 8px;
    --intent-spacing-md: 16px;
    --intent-spacing-lg: 24px;
    --intent-spacing-xl: 32px;
    --intent-spacing-touchTarget: 44px;

    /* Typography */
    --intent-typography-fontFamily-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --intent-typography-fontFamily-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    --intent-typography-fontSize-xs: 12px;
    --intent-typography-fontSize-sm: 14px;
    --intent-typography-fontSize-md: 16px;
    --intent-typography-fontSize-lg: 20px;
    --intent-typography-fontSize-xl: 24px;
    --intent-typography-fontWeight-normal: 400;
    --intent-typography-fontWeight-medium: 500;
    --intent-typography-fontWeight-bold: 700;
    --intent-typography-lineHeight-tight: 1.25;
    --intent-typography-lineHeight-normal: 1.5;
    --intent-typography-lineHeight-relaxed: 1.75;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --intent-color-background: #1a1a2e;
      --intent-color-surface: #16213e;
      --intent-color-text-primary: #eaeaea;
      --intent-color-text-secondary: #a0a0a0;
      --intent-color-border: #2a2a4a;
    }
  }
`;
}

function generateBaseStyles(): string {
  return `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; font-family: var(--intent-typography-fontFamily-sans); font-size: var(--intent-typography-fontSize-md); line-height: var(--intent-typography-lineHeight-normal); color: var(--intent-color-text-primary); background: var(--intent-color-background); }

  .intent-screen { display: flex; flex-direction: column; min-height: 100%; }
  .intent-container { display: flex; }
  .intent-container[style*="direction: column"] { flex-direction: column; }
  .intent-container[style*="direction: row"] { flex-direction: row; }
  .intent-text { display: inline-block; }
  .intent-button { border: none; cursor: pointer; font-family: inherit; font-size: inherit; padding: var(--intent-spacing-sm) var(--intent-spacing-md); border-radius: 4px; min-width: var(--intent-spacing-touchTarget); min-height: var(--intent-spacing-touchTarget); }
  .intent-button:disabled { opacity: 0.5; cursor: not-allowed; }
  .intent-button-primary { background: var(--intent-color-primary); color: white; }
  .intent-button-primary:hover:not(:disabled) { background: var(--intent-color-primaryHover); }
  .intent-button-secondary { background: var(--intent-color-secondary); color: white; }
  .intent-button-outline { background: transparent; border: 2px solid var(--intent-color-primary); color: var(--intent-color-primary); }
  .intent-button-ghost { background: transparent; color: var(--intent-color-primary); }
  .intent-button-destructive { background: var(--intent-color-error); color: white; }
  .intent-input { font-family: inherit; font-size: inherit; padding: var(--intent-spacing-sm) var(--intent-spacing-md); border: 1px solid var(--intent-color-border); border-radius: 4px; background: var(--intent-color-background); color: var(--intent-color-text-primary); min-height: var(--intent-spacing-touchTarget); }
  .intent-input:focus { outline: 2px solid var(--intent-color-focus); outline-offset: 2px; }
  .intent-image { max-width: 100%; height: auto; display: block; }
  .intent-fit-cover { object-fit: cover; }
  .intent-fit-contain { object-fit: contain; }
  .intent-fit-fill { object-fit: fill; }
  .intent-fit-scale-down { object-fit: scale-down; }
  .intent-fit-none { object-fit: none; }

  /* Focus visible polyfill */
  :focus:not(:focus-visible) { outline: none; }
  :focus-visible { outline: 2px solid var(--intent-color-focus); outline-offset: 2px; }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  }
`;
}

const DEFAULT_HTML_OPTIONS: Required<HtmlExportOptions> = {
  includeStyles: true,
  includeScripts: true,
  inlineAssets: true,
  basePath: "/",
  cspNonce: "",
};

export function exportToHtml(scene: Scene, options: HtmlExportOptions = {}): string {
  const opts = { ...DEFAULT_HTML_OPTIONS, ...options };
  const validated = validateScene(scene);

  const screens = Object.values(validated.screens).sort((a, b) => {
    const idxA = validated.screenOrder.indexOf(a.id);
    const idxB = validated.screenOrder.indexOf(b.id);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  if (screens.length === 0) {
    screens.push(...Object.values(validated.screens));
  }

  const screenHtml = screens.map((screen) => {
    const allObjects = { ...validated.objects };
    return renderObject(screen, allObjects);
  }).join("\n\n");

  const cssVars = opts.includeStyles ? generateCssVariables() : "";
  const baseStyles = opts.includeStyles ? generateBaseStyles() : "";
  const cspAttr = opts.cspNonce ? ` nonce="${escapeHtml(opts.cspNonce)}"` : "";
  const csp = buildCsp(opts.cspNonce);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
  <title>${escapeHtml(validated.metadata.name ?? "Intent Export")}</title>
  ${cssVars ? `<style${cspAttr}>${cssVars}</style>` : ""}
  ${baseStyles ? `<style${cspAttr}>${baseStyles}</style>` : ""}
  ${opts.includeScripts ? `<script${cspAttr}>
    (function() {
      window.__INTENT_SCENE__ = ${escapeJsonForScript(JSON.stringify(validated))};
      window.__INTENT_VERSION__ = ${SCENE_SCHEMA_VERSION};
    })();
  </script>` : ""}
</head>
<body>
${screenHtml}
${opts.includeScripts ? `<script${cspAttr}>
  document.addEventListener("DOMContentLoaded", function() {
    document.querySelectorAll("[data-object-id]").forEach(function(el) {
      el.addEventListener("click", function(e) {
        window.postMessage({ type: "INTENT_CLICK", objectId: this.dataset.objectId }, "*");
      });
    });
  });
</script>` : ""}
</body>
</html>`;
}

export async function exportSceneToFile(scene: Scene, filePath: string, options: HtmlExportOptions = {}): Promise<void> {
  const html = exportToHtml(scene, options);
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, html, "utf-8");
}
