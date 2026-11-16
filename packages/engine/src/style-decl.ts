import { sanitizeCssValue } from "./sanitize.js";

/**
 * Shared CSS-declaration machinery for every renderer (HTML, React, preview,
 * state/responsive CSS, RenderModel). One splitter, one closed grammar, one
 * kebab-case converter — no renderer re-implements them.
 *
 * Grammar (trd 13.2): property names are lowercase kebab-case or CSS custom
 * properties (--x-y); values pass `sanitizeCssValue` — anything else is dropped.
 */

const SAFE_PROPERTY = /^(--[a-zA-Z0-9_-]+|-?[a-z][a-z0-9-]*)$/;

/** Properties whose numeric values must NOT carry a px unit. */
const UNITLESS = new Set(["font-weight", "line-height", "opacity", "z-index", "flex-grow", "flex-shrink", "order", "stroke-opacity", "fill-opacity"]);

export type SceneStyle = Record<string, unknown>;

/** Maps a token reference ("token.color.primary") to its CSS custom property. */
export function tokenToCssVar(token: string): string {
  // Token paths are dot-separated; CSS var names are hyphenated. "token.color.text.primary"
  // must become var(--intent-color-text-primary), not var(--intent-color-text.primary).
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

/** Resolves a scene value to its CSS-facing string (token refs become var(--…)). */
export function resolveSceneValue(val: unknown, prop?: string): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") {
    if (prop && UNITLESS.has(prop)) return `${val}`;
    return `${val}px`;
  }
  if (typeof val === "string") {
    if (val.startsWith("token.color.") || val.startsWith("token.spacing.") || val.startsWith("token.typography.")) {
      return tokenToCssVar(val);
    }
    return val;
  }
  if (typeof val === "object") {
    const rec = val as Record<string, unknown>;
    if (rec["$type"] === "token" && typeof rec["$value"] === "string") {
      return tokenToCssVar(rec["$value"]);
    }
    return "";
  }
  return String(val);
}

/** Maps a camelCase or kebab-case style key to a lowercase kebab-case CSS property, or null if unsafe. */
export function toCssProperty(key: string): string | null {
  if (!SAFE_PROPERTY.test(key)) {
    const kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    if (SAFE_PROPERTY.test(kebab)) return kebab;
    return null;
  }
  return key.toLowerCase();
}

/**
 * Splits a scene style record into [property, value] declaration pairs.
 * Token references resolve to var(--…); unsafe keys/values are dropped.
 */
export function styleDeclarations(style: SceneStyle | undefined): [string, string][] {
  if (!style || typeof style !== "object") return [];
  const out: [string, string][] = [];
  for (const [rawKey, rawVal] of Object.entries(style)) {
    const prop = toCssProperty(rawKey);
    if (!prop) continue;
    const resolved = resolveSceneValue(rawVal, prop);
    const value = sanitizeCssValue(resolved);
    if (value) out.push([prop, value]);
  }
  return out;
}

/** Joins declarations as a single declaration-block body (no braces). */
export function styleBlock(style: SceneStyle | undefined): string {
  return styleDeclarations(style)
    .map(([prop, value]) => `${prop}: ${value};`)
    .join(" ");
}
