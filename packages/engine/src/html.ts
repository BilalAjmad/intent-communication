import {
  Scene,
  validateScene,
  SCENE_SCHEMA_VERSION,
} from "@intent/schema";
import { renderModelNodeHtml, RENDER_MAX_NODES } from "./render-html.js";
import { styleBlock } from "./style-decl.js";
import { lightRootBlock, darkMediaBlock } from "./vars.js";
import { normalizeSceneToModel } from "./model.js";
import { expandComponentInstances } from "./components.js";
import { renderStateCss } from "./state-css.js";
import { renderResponsiveCss, DEFAULT_BREAKPOINTS } from "./responsive-css.js";
import type { Breakpoints } from "@intent/schema";
import {
  escapeJsonForScript,
  buildCsp,
  sanitizeNonce,
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
  breakpoints?: Breakpoints;
  /** Emit data-object-id on every object (fidelity tests & tooling). Defaults to true. */
  includeDataIds?: boolean;
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

/** @deprecated kept for API compatibility — delegates to styleBlock (style-decl.ts). */
function buildStyleString(style: Record<string, unknown>): string {
  return styleBlock(style);
}

function generateCssVariables(): string {
  return `
${lightRootBlock()}

${darkMediaBlock()}
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
  .intent-button:active:not(:disabled) { opacity: 0.85; }
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
  .intent-link:visited { color: var(--intent-color-text-secondary); }
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
  breakpoints: DEFAULT_BREAKPOINTS,
  includeDataIds: true,
};

export function exportToHtml(scene: Scene, options: HtmlExportOptions = {}): string {
  const opts = { ...DEFAULT_HTML_OPTIONS, ...options };
  const validated = validateScene(scene);
  const renderScene = expandComponentInstances(validated);
  const stateCss = opts.includeStyles ? renderStateCss(renderScene) : "";
  const responsiveCss = opts.includeStyles ? renderResponsiveCss(renderScene, opts.breakpoints) : "";
  const model = normalizeSceneToModel(validated, { breakpoints: opts.breakpoints });

  const includeDataIds = opts.includeDataIds !== false;
  const screenHtml = model.screens
    .map((screen) => renderModelNodeHtml(screen.root, 0, { remaining: RENDER_MAX_NODES }, includeDataIds))
    .join("\n\n");

  const cssVars = opts.includeStyles ? generateCssVariables() : "";
  const baseStyles = opts.includeStyles ? generateBaseStyles() : "";
  const safeNonce = sanitizeNonce(opts.cspNonce);
  const cspAttr = safeNonce ? ` nonce="${escapeHtml(safeNonce)}"` : "";
  const stateStyle = stateCss ? `\n  <style${cspAttr}>\n${stateCss}\n  </style>` : "";
  const responsiveStyle = responsiveCss ? `\n  <style${cspAttr}>\n${responsiveCss}\n  </style>` : "";
  const csp = buildCsp(safeNonce);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
  <title>${escapeHtml(validated.metadata.name ?? "Intent Export")}</title>
  ${cssVars ? `<style${cspAttr}>${cssVars}</style>` : ""}
  ${baseStyles ? `<style${cspAttr}>${baseStyles}</style>` : ""}${stateStyle}${responsiveStyle}
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
