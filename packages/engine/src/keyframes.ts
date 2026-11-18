import type { Keyframes } from "@intent/schema";
import { sanitizeCssValue } from "./sanitize.js";
import { toCssProperty } from "./style-decl.js";

/**
 * Sanitizes the scene keyframes table (trd 13.6). Invalid names/offsets/
 * properties/values are dropped; a table with nothing left returns undefined.
 * Determinism: insertion order of the scene JSON, consumers sort on emit.
 */
export function sanitizeKeyframes(input: Keyframes | undefined): Keyframes | undefined {
  if (!input) return undefined;
  const out: Keyframes = {};
  for (const [name, steps] of Object.entries(input)) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]{0,63}$/.test(name)) continue;
    const cleanSteps: Record<string, Record<string, string>> = {};
    for (const [offset, decls] of Object.entries(steps ?? {})) {
      if (!/^(from|to|(100|[0-9]{1,2})(\.\d+)?%)$/.test(offset)) continue;
      const cleanDecls: Record<string, string> = {};
      for (const [prop, value] of Object.entries(decls ?? {})) {
        const p = toCssProperty(prop);
        const v = sanitizeCssValue(typeof value === "string" ? value : "");
        if (p && v) cleanDecls[p] = v;
      }
      if (Object.keys(cleanDecls).length > 0) cleanSteps[offset] = cleanDecls;
    }
    if (Object.keys(cleanSteps).length > 0) out[name] = cleanSteps;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
