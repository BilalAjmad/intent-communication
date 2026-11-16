import {
  Scene,
  SceneObject,
  validateScene,
  SCENE_SCHEMA_VERSION,
} from "@intent/schema";
import type { SceneValue } from "./index.js";
import { renderIconMarkup } from "./icons.js";
import { renderStateCss } from "./state-css.js";
import {
  escapeJsonForScript,
  sanitizeCssValue,
  sanitizeUrl,
  safeClassToken,
  buildCsp,
  sanitizeNonce,
} from "./sanitize.js";
import { IntentError, ErrorCodes } from "@intent/core";

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

function escapeHtml(str: unknown): string {
  const s = typeof str === "string" ? str : str == null ? "" : String(str);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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
  // Only real CSS property names and custom properties — a key like
  // "background:url(https://x); x" would otherwise inject a whole declaration.
  const SAFE_KEY = /^(--[a-zA-Z0-9_-]+|-?[a-z][a-z0-9-]*)$/;
  for (const [key, val] of Object.entries(style)) {
    const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    if (!SAFE_KEY.test(cssKey)) continue;
    const value = sanitizeCssValue(resolveValue(val));
    if (value) {
      declarations.push(`${cssKey}: ${value};`);
    }
  }
  return declarations.join(" ");
}

/** Input types allowed in the exported markup. */
const ALLOWED_INPUT_TYPES = new Set(["text", "email", "password", "number", "tel", "url"]);

// Renders are bounded: a corrupt/hostile scene graph can never blow the stack or
// the output. Depth runs out first on deep nesting; the node budget stops exponential
// diamond reuse.
const MAX_DEPTH = 200;
const MAX_NODES = 5000;

function renderObject(
  obj: SceneObject,
  allObjects: Record<string, SceneObject>,
  depth: number = 0,
  budget: { remaining: number } = { remaining: MAX_NODES },
): string {
  if (depth > MAX_DEPTH || budget.remaining <= 0) {
    throw new IntentError(ErrorCodes.E_LIMIT, "Scene exceeds render depth/size budget");
  }
  budget.remaining -= 1;
  const indent = "  ".repeat(depth);
  const styleStr = buildStyleString(obj.style);
  const styleAttr = styleStr ? ` style="${escapeHtml(styleStr)}"` : "";
  const children = obj.children.map((id) => {
    const child = allObjects[id];
    if (!child) return `<!-- missing child ${escapeHtml(id)} -->`;
    return renderObject(child, allObjects, depth + 1, budget);
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

    case "checkbox": {
      const label = escapeHtml((obj.props.label as string) ?? "Checkbox");
      const checked = obj.props.checked ? " checked" : "";
      const disabled = obj.props.disabled ? " disabled" : "";
      const name = typeof obj.props.name === "string" && obj.props.name ? ` name="${escapeHtml(obj.props.name)}"` : "";
      return `${indent}<label class="intent-checkbox" data-object-id="${escapeHtml(obj.id)}"${styleAttr}><input type="checkbox"${name}${checked}${disabled} /><span>${label}</span></label>`;
    }

    case "radio": {
      const label = escapeHtml((obj.props.label as string) ?? "Option");
      const checked = obj.props.checked ? " checked" : "";
      const disabled = obj.props.disabled ? " disabled" : "";
      const name = typeof obj.props.name === "string" && obj.props.name ? ` name="${escapeHtml(obj.props.name)}"` : "";
      const value = typeof obj.props.value === "string" && obj.props.value ? ` value="${escapeHtml(obj.props.value)}"` : "";
      return `${indent}<label class="intent-radio" data-object-id="${escapeHtml(obj.id)}"${styleAttr}><input type="radio"${name}${value}${checked}${disabled} /><span>${label}</span></label>`;
    }

    case "switch": {
      const label = escapeHtml((obj.props.label as string) ?? "Toggle");
      const checked = obj.props.checked ? " checked" : "";
      const disabled = obj.props.disabled ? " disabled" : "";
      const name = typeof obj.props.name === "string" && obj.props.name ? ` name="${escapeHtml(obj.props.name)}"` : "";
      return `${indent}<label class="intent-switch" data-object-id="${escapeHtml(obj.id)}"${styleAttr}><input type="checkbox" role="switch"${name}${checked}${disabled} /><span class="switch-track"></span><span>${label}</span></label>`;
    }

    case "link": {
      const label = escapeHtml((obj.props.label as string) ?? "Link");
      const href = sanitizeUrl(obj.props.href);
      const target = safeClassToken(obj.props.target, "_self");
      const targetAttr = target === "_self" ? "" : ` target="${target}"`;
      // trd rule 8: external URLs never ship in the export; rels are allowlisted.
      const SAFE_REL = new Set(["noopener", "noreferrer", "nofollow"]);
      const rawRel = typeof obj.props.rel === "string" ? obj.props.rel : "";
      const rels = rawRel.split(/\s+/).filter((t) => SAFE_REL.has(t));
      if (target === "_blank" && !rels.includes("noopener")) rels.push("noopener");
      const relAttr = rels.length ? ` rel="${rels.join(" ")}"` : "";
      const hrefAttr = href ? ` href="${escapeHtml(href)}"` : "";
      return `${indent}<a class="intent-link"${hrefAttr}${targetAttr}${relAttr} data-object-id="${escapeHtml(obj.id)}"${styleAttr}>${label}</a>`;
    }

    case "list": {
      const items = Array.isArray(obj.props.items) ? (obj.props.items as string[]) : [];
      const ordered = obj.props.ordered === true;
      const tag = ordered ? "ol" : "ul";
      const lis = items.map((item) => `${indent}  <li>${escapeHtml(item)}</li>`).join("\n");
      return `${indent}<${tag} class="intent-list" data-object-id="${escapeHtml(obj.id)}"${styleAttr}>\n${lis}\n${indent}</${tag}>`;
    }

    case "modal": {
      const title = escapeHtml((obj.props.title as string) ?? "");
      const size = safeClassToken(obj.props.size, "md");
      const modalClass = size === "md" ? "intent-modal" : `intent-modal intent-modal-${size}`;
      const openAttr = obj.props.open ? " open" : "";
      const titleHtml = title ? `\n${indent}  <h2 class="intent-modal-title">${title}</h2>` : "";
      return `${indent}<dialog class="${modalClass}"${openAttr} data-object-id="${escapeHtml(obj.id)}"${styleAttr}>${titleHtml}\n${children}\n${indent}</dialog>`;
    }

    case "icon":
      return `${indent}${renderIconMarkup(obj.props.icon, obj.props.size, obj.props.color, obj.props.label, { objectId: obj.id, styleAttr })}`;

    case "divider": {
      const direction = obj.props.direction === "vertical" ? "vertical" : "horizontal";
      const thicknessRaw = typeof obj.props.thickness === "number" && Number.isFinite(obj.props.thickness) ? obj.props.thickness : 1;
      const thickness = Math.min(Math.max(Math.floor(thicknessRaw), 1), 32);
      const base = buildStyleString(obj.style);
      const dimension = direction === "horizontal" ? `height: ${thickness}px;` : `width: ${thickness}px;`;
      const merged = [base, dimension].filter(Boolean).join(" ").trim();
      const mergedAttr = merged ? ` style="${escapeHtml(merged)}"` : "";
      return `${indent}<hr class="intent-divider intent-divider-${direction}" role="separator"${mergedAttr} data-object-id="${escapeHtml(obj.id)}" />`;
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
  .intent-checkbox, .intent-radio, .intent-switch { display: inline-flex; align-items: center; gap: var(--intent-spacing-sm); min-height: var(--intent-spacing-touchTarget); cursor: pointer; user-select: none; }
  .intent-checkbox input, .intent-radio input, .intent-switch input { width: 18px; height: 18px; accent-color: var(--intent-color-primary); }
  .intent-checkbox input:disabled + span, .intent-radio input:disabled + span, .intent-switch input:disabled ~ span { opacity: 0.5; cursor: not-allowed; }
  .intent-switch .switch-track { position: relative; width: 36px; height: 20px; border-radius: 9999px; background: var(--intent-color-border); transition: background 0.15s ease; }
  .intent-switch .switch-track::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
  .intent-switch input:checked + .switch-track { background: var(--intent-color-primary); }
  .intent-switch input:checked + .switch-track::after { transform: translateX(16px); }
  .intent-link { color: var(--intent-color-primary); text-decoration: underline; text-underline-offset: 2px; cursor: pointer; display: inline-flex; align-items: center; min-height: var(--intent-spacing-touchTarget); }
  .intent-link:hover { color: var(--intent-color-primaryHover); }
  .intent-list { padding-inline-start: var(--intent-spacing-lg); margin: 0; }
  .intent-list li { padding: var(--intent-spacing-xs) 0; }
  .intent-modal { border: none; border-radius: 8px; background: var(--intent-color-surface); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); padding: var(--intent-spacing-lg); max-width: min(480px, 90vw); }
  .intent-modal::backdrop { background: rgba(0, 0, 0, 0.45); }
  .intent-modal-title { margin: 0 0 var(--intent-spacing-md); font-size: var(--intent-typography-fontSize-lg); font-weight: var(--intent-typography-fontWeight-bold); color: var(--intent-color-text-primary); }
  .intent-modal-sm { max-width: min(360px, 90vw); }
  .intent-modal-lg { max-width: min(640px, 90vw); }
  .intent-icon { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }
  .intent-icon svg { width: 100%; height: 100%; }
  .intent-divider { border: 0; background: var(--intent-color-border); }
  .intent-divider-horizontal { width: 100%; height: 1px; }
  .intent-divider-vertical { width: 1px; height: 100%; align-self: stretch; }

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
  const stateCss = opts.includeStyles ? renderStateCss(validated) : "";

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
  const safeNonce = sanitizeNonce(opts.cspNonce);
  const cspAttr = safeNonce ? ` nonce="${escapeHtml(safeNonce)}"` : "";
  const stateStyle = stateCss ? `\n  <style${cspAttr}>\n${stateCss}\n  </style>` : "";
  const csp = buildCsp(safeNonce);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
  <title>${escapeHtml(validated.metadata.name ?? "Intent Export")}</title>
  ${cssVars ? `<style${cspAttr}>${cssVars}</style>` : ""}
  ${baseStyles ? `<style${cspAttr}>${baseStyles}</style>` : ""}${stateStyle}
  ${opts.includeScripts ? `<script${cspAttr}>
    (function() {
      window.__INTENT_SCENE__ = ${escapeJsonForScript(JSON.stringify(validated))};
      window.__INTENT_VERSION__ = ${SCENE_SCHEMA_VERSION};
    })();
  </script>` : ""}
</head>
<body>
${screenHtml}
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
