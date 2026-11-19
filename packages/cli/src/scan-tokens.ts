/**
 * trd 16 — token flattening helpers shared by the tailwind, W3C tokens.json
 * and CSS :root scanners. All functions are pure and deterministic (sorted
 * iteration).
 */
import type { DesignProfile } from "./scan-profile.js";

const PX = /^(-?\d+(?:\.\d+)?)px$/;
export const pxTo = (value: string): string | null => {
  const match = PX.exec(value.trim());
  return match ? `${match[1]}px` : null;
};

/** Flattens nested literal records ({ a: { b: x } }) into Record<string, string>; keys joined by "-". */
export function flattenLiterals(obj: unknown, prefix: string, out: Record<string, string>): void {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  const codepointCompare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const entries = Object.entries(obj as Record<string, unknown>).sort(([a], [b]) => codepointCompare(a, b));
  for (const [key, value] of entries) {
    const flatKey = prefix ? `${prefix}-${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenLiterals(value, flatKey, out);
      continue;
    }
    if (typeof value === "string" || typeof value === "number") {
      out[flatKey] = String(value);
    }
  }
}

/** Recursively collects W3C $value leaves (path -> string value). Unsupported shapes are skipped. */
export function flattenW3cTokens(node: unknown, path: string, out: Record<string, string>): void {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith("$")) continue;
    const childPath = path ? `${path}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if ("$value" in obj) {
        const v = obj["$value"];
        if (typeof v === "string" || typeof v === "number") out[childPath] = String(v);
        continue;
      }
      flattenW3cTokens(value, childPath, out);
    }
  }
}

const W3C_SECTIONS: Array<[RegExp, keyof DesignProfile["tokens"]]> = [
  [/(^|\.)(color|colors)(\.|$)/i, "colors"],
  [/(^|\.)(spacing|space|gap)(\.|$)/i, "spacing"],
  [/(^|\.)(radius|radii|rounded|corner)(\.|$)/i, "radii"],
  [/(^|\.)(fontFamily|font-family|typeface)(\.|$)/i, "fontFamily"],
  [/(^|\.)(fontSize|font-size|textSize|size)(\.|$)/i, "fontSize"],
];

export function assignW3cTokens(tokens: DesignProfile["tokens"], flat: Record<string, string>): number {
  let added = 0;
  for (const [path, value] of Object.entries(flat).sort(([a], [b]) => codepointCompare(a, b))) {
    for (const [pattern, section] of W3C_SECTIONS) {
      if (pattern.test(path)) {
        if (!(path in tokens[section])) {
          tokens[section][path] = value;
          added += 1;
        }
        break;
      }
    }
  }
  return added;
}
