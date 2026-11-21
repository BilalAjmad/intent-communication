import { escapeHtml, sanitizeCssValue } from "./sanitize.js";

// trd 13.x / M2.A: inline SVG icons for the `icon` object type.
//
// No icon font, no external sprite, no runtime dependency — the export must
// stay a single self-contained file (trd 13.3, 13.5). Every icon is a small
// stroke-based glyph on a 24x24 grid. Unknown icon names fall back to a
// neutral marker glyph instead of failing the render or guessing artwork.
const ICONS: Record<string, string> = {
  info: '<circle cx="12" cy="12" r="9" /><line x1="12" y1="11.2" x2="12" y2="16" /><line x1="12" y1="8" x2="12.01" y2="8" />',
  check: '<polyline points="20 6 9 17 4 10" />',
  close: '<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />',
  warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />',
  add: '<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />',
  search: '<circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />',
  "chevron-right": '<polyline points="9 18 15 12 9 6" />',
  "chevron-down": '<polyline points="6 9 12 15 18 9" />',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />',
  user: '<circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />',
  settings: '<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />',
};
const FALLBACK_ICON = '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />';

function tokenToCssVar(token: string): string {
  const toVarSuffix = (raw: string): string => raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (token.startsWith("token.color.")) {
    return `var(--intent-color-${toVarSuffix(token.slice("token.color.".length))})`;
  }
  if (token.startsWith("token.spacing.")) {
    return `var(--intent-spacing-${toVarSuffix(token.slice("token.spacing.".length))})`;
  }
  if (token.startsWith("token.typography.")) {
    return `var(--intent-typography-${toVarSuffix(token.slice("token.typography.".length))})`;
  }
  return token;
}

function resolveColor(color: unknown): string {
  if (typeof color === "string" && color) return color;
  if (color && typeof color === "object" && "$type" in color) {
    const value = (color as { $value?: unknown }).$value;
    if (typeof value === "string") return tokenToCssVar(value);
  }
  return "currentColor";
}

export interface IconRenderOptions {
  /** Pre-escaped ` style="..."` fragment for the object's own styles. */
  styleAttr?: string;
  /** data-object-id for selection/inspection. */
  objectId?: string;
}

export interface IconJsxOptions {
  /** React style object literal text, e.g. `{{"color":"red"}}` - optional. */
  styleObject?: string;
  /** Space-separated extra classes merged onto the icon's span (trd 13.7 tailwind mapping). */
  className?: string;
  /** data-object-id for selection/inspection. */
  objectId?: string;
}

/**
 * The inner markup of the `icon` object type (a span wrapping an inline SVG).
 * `icon`/`size`/`color`/`label` come from the scene and are therefore hostile
 * input: the name is matched against a closed allowlist, the size is clamped
 * to 1..256, and the color passes the closed CSS-value grammar sanitizer.
 */
export function renderIconMarkup(
  icon: unknown,
  size: unknown,
  color: unknown,
  label: unknown,
  options: IconRenderOptions = {},
): string {
  const name = typeof icon === "string" ? icon.trim().toLowerCase() : "";
  const body = ICONS[name] ?? FALLBACK_ICON;
  const rawSize = typeof size === "number" && Number.isFinite(size) ? Math.floor(size) : 24;
  const s = Math.min(Math.max(rawSize, 1), 256);
  const safeColor = sanitizeCssValue(resolveColor(color));
  const stroke = safeColor ? escapeHtml(safeColor) : "currentColor";
  const safeLabel = typeof label === "string" && label.trim() ? escapeHtml(label.trim()) : "";
  const aria = safeLabel
    ? ` role="img" aria-label="${safeLabel}"`
    : ' aria-hidden="true" focusable="false"';
  const idAttr = options.objectId ? ` data-object-id="${escapeHtml(options.objectId)}"` : "";
  const style = options.styleAttr ?? "";
  return `<span class="intent-icon"${idAttr}${aria}${style}><svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg></span>`;
}

/**
 * JSX variant of the icon markup for the React exporter. Same allowlisted
 * glyphs and size clamp; attribute values are emitted through
 * JSON.stringify-in-expression form so scene-derived strings can never break
 * out of the attribute.
 */
export function renderIconJsx(
  icon: unknown,
  size: unknown,
  color: unknown,
  label: unknown,
  options: IconJsxOptions = {},
): string {
  const name = typeof icon === "string" ? icon.trim().toLowerCase() : "";
  const body = ICONS[name] ?? FALLBACK_ICON;
  const rawSize = typeof size === "number" && Number.isFinite(size) ? Math.floor(size) : 24;
  const s = Math.min(Math.max(rawSize, 1), 256);
  const rawColor = sanitizeCssValue(resolveColor(color));
  const stroke = rawColor ? JSON.stringify(rawColor) : '"currentColor"';
  const rawLabel = typeof label === "string" && label.trim() ? label.trim() : "";
  const aria = rawLabel
    ? ` role="img" aria-label={${JSON.stringify(rawLabel)}}`
    : ' aria-hidden="true"';
  const idAttr = options.objectId ? ` data-object-id={${JSON.stringify(options.objectId)}}` : "";
  const style = options.styleObject ? ` style={${options.styleObject}}` : "";
  // SVG presentation attributes in JSX must be camelCase; the shared glyph
  // bodies only use lowercase SVG attributes that are valid in both forms
  // except the ones below, so keep bodies as-is (all are valid JSX as-is).
  // Dedupe: the model already classifies icons as "intent-icon"; the caller's
  // className may carry it too — never emit a class twice.
  const extraClasses = options.className
    ? ` ${[...new Set(options.className.split(/\s+/).filter(Boolean))].filter((c) => c !== "intent-icon").join(" ")}`.trimEnd()
    : "";
  const spanClass = extraClasses.length > 0 ? `intent-icon ${extraClasses.slice(1)}` : "intent-icon";
  return `<span className="${spanClass}"${idAttr}${aria}${style}><svg width={${s}} height={${s}} viewBox="0 0 24 24" fill="none" stroke={${stroke}} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">${body}</svg></span>`;
}
