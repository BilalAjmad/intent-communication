import type { Scene, SceneObject, StateName } from "@intent/schema";
import { styleDeclarations } from "./style-decl.js";

/**
 * trd 5.3 State CSS generation.
 *
 * Pseudo-states become attribute-selector rules with the matching pseudo-class
 * (element carries data-object-id already, so no extra class is needed).
 * Data states become `[data-state~="<name>"]` rules; the exported document has
 * no interaction script wired yet, so data states activate only when a host
 * (or the preview's forced-state control) sets the attribute.
 *
 * `visible: false` in an override emits `display: none !important`.
 * `props`/`text` overrides are intentionally NOT rendered as CSS — they need
 * a live Inspector/runtime, not static markup.
 */
const PSEUDO_CLASS: Partial<Record<StateName, string>> = {
  hover: ":hover",
  pressed: ":active",
  focus: ":focus-visible",
  disabled: ":disabled",
  visited: ":visited",
  checked: ":checked",
  filled: ":not(:placeholder-shown)",
};

const DATA_STATES: ReadonlySet<StateName> = new Set([
  "loading",
  "error",
  "empty",
  "open",
  "success",
  "submitting",
  "content",
  "filled",
]);

const SAFE_OBJECT_ID = /^[A-Za-z0-9_-]+$/;

/** Declarations for one state override (used by renderStateCss and the RenderModel normalizer). */
export function stateDeclarations(style: Record<string, SceneObject["style"][string]>): string[] {
  return styleDeclarations(style).map(([prop, value]) => `${prop}: ${value}`);
}

/** Returns per-object state rules for a validated scene (no em/comments). */
export function renderStateCss(scene: Scene): string {
  const lines: string[] = [];
  for (const obj of Object.values(scene.objects)) {
    if (!obj || typeof obj !== "object") continue;
    const states = obj.states;
    if (!states || typeof states !== "object") continue;
    if (!SAFE_OBJECT_ID.test(obj.id)) continue;
    const id = obj.id;
    for (const [name, override] of Object.entries(states)) {
      if (!override || typeof override !== "object") continue;
      const pseudo = PSEUDO_CLASS[name as StateName];
      const isData = DATA_STATES.has(name as StateName);
      const selector = pseudo
        ? `[data-object-id="${id}"]${pseudo}`
        : isData
          ? `[data-object-id="${id}"][data-state~="${name}"]`
          : null;
      if (!selector) continue;
      const decls = override.style ? stateDeclarations(override.style) : [];
      if (decls.length > 0) {
        lines.push(`${selector} { ${decls.join(" ")} }`);
      }
      if (override.visible === false) {
        lines.push(`${selector} { display: none !important; }`);
      }
    }
  }
  return lines.join("\n");
}
