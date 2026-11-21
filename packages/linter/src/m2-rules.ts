import type { Scene, SceneObject } from "@intent/schema";
import type { LintRule, LintViolation, LintProfile } from "./index.js";
import { hexToRgb } from "./color.js";

/**
 * M2 linter rules (design.md §9 M2 column, §10 required states, §11 hierarchy).
 * Scope, honestly:
 *   L-TYPE    — fontSize in the type scale; ≤3 distinct fontWeights per screen.
 *   L-TOKEN   — no raw colors (hex/rgb/hsl) in color-ish paths; raw allowed on locked objects.
 *   L-STATES  — required data states declared per component (design.md §10 table).
 *   L-ALIGN   — near-miss alignment edges in free-positioned stacks (1-3px deltas).
 *   L-HIER    — ≤1 primary action per container subtree; ≤1 display-size heading per screen.
 *   L-A11Y    — images need alt; inputs need a non-empty placeholder or ariaLabel; buttons need a name.
 *   L-CONTENT — lorem ipsum / placeholder-ish copy is flagged.
 * Not implemented (no model to check against): heading levels never skip (no h1-h6 prop in this
 * scene model); line-length, spacing rhythm and color discipline are design judgment, not lint.
 */

const TYPE_SCALE = new Set([12, 14, 16, 20, 24, 32, 40, 48]);
// Raw colors anywhere — hex, functional notations, oklch/lab/hwb/color, named colors, gradients.
const RAW_COLOR = /(#[0-9a-fA-F]{3,8}\b|rgba?\s*\(|hsla?\s*\(|hwb\s*\(|oklch\s*\(|oklab\s*\(|lab\s*\(|lch\s*\(|color\s*\(|\b(aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|cyan|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|whitesmoke|white|yellow|yellowgreen)\b)/i;
const COLOR_KEYS = new Set([
  "color", "background", "backgroundColor", "borderColor", "outlineColor",
  "fill", "stroke", "text", "caret", "textDecorationColor",
]);

function walker(id: string, val: unknown, path: string, fn: (id: string, leaf: unknown, path: string) => void): void {
  if (typeof val === "object" && val !== null && !Array.isArray(val) && !("$type" in (val as Record<string, unknown>))) {
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      walker(id, v, `${path}.${k}`, fn);
    }
    return;
  }
  fn(id, val, path);
}

function subtree(rootId: string, objects: Record<string, SceneObject>): string[] {
  const out: string[] = [];
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const obj = objects[id];
    if (!obj) continue;
    out.push(id);
    for (const child of obj.children) stack.push(child);
  }
  return out;
}

function screenBodies(scene: Scene): { screenId: string; memberIds: string[] }[] {
  return Object.keys(scene.screens)
    .sort()
    .map((screenId) => ({ screenId, memberIds: subtree(screenId, scene.objects) }));
}

function checkType(scene: Scene, violations: LintViolation[]): void {
  for (const [id, obj] of Object.entries(scene.objects)) {
    const fontSize = (obj.props ?? {})["fontSize"];
    if (typeof fontSize === "number" && !TYPE_SCALE.has(fontSize)) {
      violations.push({
        ruleId: "L-TYPE",
        objectId: id,
        message: `fontSize ${fontSize} is not in the type scale (12, 14, 16, 20, 24, 32, 40, 48)`,
        severity: "warning",
        path: "props.fontSize",
        suggestion: "Use a type-scale size",
      });
    }
  }
  for (const { screenId, memberIds } of screenBodies(scene)) {
    const weights = new Set<unknown>();
    for (const id of memberIds) {
      const w = (scene.objects[id]?.props ?? {})["fontWeight"];
      if (w !== undefined) weights.add(w);
    }
    if (weights.size > 3) {
      violations.push({
        ruleId: "L-TYPE",
        objectId: screenId,
        message: `Screen uses ${weights.size} distinct font weights; at most 3 is the design default`,
        severity: "warning",
        path: "screen",
        suggestion: "Consolidate to at most 3 font weights",
      });
    }
  }
}

/** Nearest hex token in the design profile to `hex`, by squared RGB distance. */
function nearestProfileColor(hex: string, profile: LintProfile | undefined): { key: string; hex: string } | null {
  const rgb = hexToRgb(hex);
  const colors = profile?.tokens?.colors;
  if (!rgb || !colors) return null;
  let best: { key: string; hex: string; distance: number } | null = null;
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value !== "string") continue;
    const candidate = value.trim();
    const other = hexToRgb(candidate);
    if (!other) continue;
    const dx = other[0] - rgb[0];
    const dy = other[1] - rgb[1];
    const dz = other[2] - rgb[2];
    const distance = dx * dx + dy * dy + dz * dz;
    if (!best || distance < best.distance) best = { key, hex: candidate, distance };
  }
  return best ? { key: best.key, hex: best.hex } : null;
}

function checkToken(
  scene: Scene,
  locks: string[],
  violations: LintViolation[],
  profile?: LintProfile,
): void {
  const locked = new Set(locks ?? []);
  for (const [id, obj] of Object.entries(scene.objects)) {
    if (locked.has(id)) continue; // locked = user-supplied asset, raw allowed (design.md §9)
    const visit = (path: string, val: unknown): void => {
      if (typeof val !== "string") return;
      const key = path.split(".").pop() ?? "";
      if (!COLOR_KEYS.has(key) && !/background/i.test(key)) return;
      if (RAW_COLOR.test(val.trim())) {
        const nearest = nearestProfileColor(val.trim(), profile);
        violations.push({
          ruleId: "L-TOKEN",
          objectId: id,
          message: `Raw color "${val.trim().slice(0, 40)}" at ${path}; use a token.color.* reference`,
          severity: "warning",
          path,
          suggestion: nearest
            ? `Use token.color.${nearest.key} (${nearest.hex})`
            : "Reference a named color token instead of a raw value",
        });
      }
    };
    for (const [k, v] of Object.entries(obj.style ?? {})) walker(id, v, `style.${k}`, (_id, leaf, path) => visit(path, leaf));
    for (const [k, v] of Object.entries(obj.props ?? {})) walker(id, v, `props.${k}`, (_id, leaf, path) => visit(path, leaf));
    // State overrides (hover/focus/error/loading/...) also emit verbatim into the export
    const states = obj.states ?? {};
    for (const [stateName, stateOverride] of Object.entries(states)) {
      const stateStyle = (stateOverride as { style?: Record<string, unknown> } | undefined)?.style;
      if (!stateStyle) continue;
      for (const [k, v] of Object.entries(stateStyle)) walker(id, v, `states.${stateName}.style.${k}`, (_id, leaf, path) => visit(path, leaf));
    }
    // Responsive overrides also ship verbatim
    const bp = obj.responsive ?? {};
    for (const bpName of ["sm", "md", "lg"] as const) {
      const bpStyle = (bp as Record<string, { style?: Record<string, unknown> } | undefined>)[bpName]?.style;
      if (!bpStyle) continue;
      for (const [k, v] of Object.entries(bpStyle)) walker(id, v, `responsive.${bpName}.style.${k}`, (_id, leaf, path) => visit(path, leaf));
    }
  }
}

// Data states are not delivered by the base export for these components;
// pseudo-states (hover/focus/disabled/pressed/checked/visited) are (see engine base CSS).
const REQUIRED_STATES: Record<string, string[]> = {
  button: ["loading"],
  input: ["filled", "error"],
  list: ["empty", "loading"],
  modal: ["open"],
};

function checkStates(scene: Scene, violations: LintViolation[]): void {
  for (const [id, obj] of Object.entries(scene.objects)) {
    const required = REQUIRED_STATES[obj.type];
    if (!required) continue;
    const declared = obj.states ?? {};
    const missing = required.filter((state) => !(state in declared));
    if (missing.length > 0) {
      violations.push({
        ruleId: "L-STATES",
        objectId: id,
        message: `${obj.type} is missing required state(s): ${missing.join(", ")} (design.md §10)`,
        severity: "error",
        path: "states",
        suggestion: `Declare states: { ${missing.map((s) => `${s}: { ... }`).join(", ")} }`,
      });
    }
  }
}

function checkAlign(scene: Scene, violations: LintViolation[]): void {
  for (const [id, obj] of Object.entries(scene.objects)) {
    if ((obj.props ?? {})["layout"] !== "absolute") continue;
    const lefts: { childId: string; left: number }[] = [];
    for (const childId of obj.children) {
      const child = scene.objects[childId];
      const left = (child?.style ?? {})["left"];
      // Scene values may be numbers or numeric strings ("100px"); parseFloat handles both.
      const n = typeof left === "number" ? left : typeof left === "string" ? Number.parseFloat(left) : Number.NaN;
      if (Number.isFinite(n)) lefts.push({ childId, left: n });
    }
    for (let i = 0; i < lefts.length; i++) {
      for (let j = i + 1; j < lefts.length; j++) {
        const delta = Math.abs(lefts[i]!.left - lefts[j]!.left);
        if (delta >= 1 && delta <= 3) {
          violations.push({
            ruleId: "L-ALIGN",
            objectId: id,
            message: `Siblings ${lefts[i]!.childId} and ${lefts[j]!.childId} have near-miss alignment edges (${delta}px apart)`,
            severity: "warning",
            path: "children",
            suggestion: "Snap sibling edges to the same x (grid)",
          });
        }
      }
    }
  }
}

function checkHier(scene: Scene, violations: LintViolation[]): void {
  const objects = scene.objects;
  for (const [id, obj] of Object.entries(objects)) {
    if (obj.type !== "container") continue;
    const ids = subtree(id, objects);
    const primaries = ids.filter((memberId) => {
      const member = objects[memberId];
      return member?.type === "button" && member.props?.["variant"] === "primary";
    });
    if (primaries.length > 1) {
      violations.push({
        ruleId: "L-HIER",
        objectId: id,
        message: `Container has ${primaries.length} primary buttons; design allows at most one primary action per container`,
        severity: "warning",
        path: "subtree",
        suggestion: "Make the secondary actions visually quieter (secondary/ghost/outline)",
      });
    }
  }
  for (const { screenId, memberIds } of screenBodies(scene)) {
    const display = memberIds.filter((id) => {
      const fsz = scene.objects[id]?.props?.["fontSize"];
      return typeof fsz === "number" && fsz >= 40;
    });
    if (display.length > 1) {
      violations.push({
        ruleId: "L-HIER",
        objectId: screenId,
        message: `Screen has ${display.length} display-size headings; design allows at most one per screen`,
        severity: "warning",
        path: "screen",
        suggestion: "Reduce secondary headings below 40px",
      });
    }
  }
}

function checkA11y(scene: Scene, violations: LintViolation[]): void {
  for (const [id, obj] of Object.entries(scene.objects)) {
    if (obj.type === "image") {
      // design.md §9 / R-R33: "Images have alt text" — not negotiable; WCAG decorative-alt
      // carve-outs are a spec change, not a lint relaxation. Missing OR empty is an error.
      const alt = (obj.props ?? {})["alt"];
      if (typeof alt !== "string" || alt.trim().length === 0) {
        violations.push({
          ruleId: "L-A11Y",
          objectId: id,
          message: "Image is missing alt text",
          severity: "error",
          path: "props.alt",
          suggestion: "Add meaningful alt text",
        });
      }
    }
    if (obj.type === "input") {
      const placeholder = (obj.props ?? {})["placeholder"];
      const ariaLabel = (obj.props ?? {})["ariaLabel"];
      if (
        (typeof placeholder !== "string" || placeholder.trim().length === 0) &&
        (typeof ariaLabel !== "string" || ariaLabel.trim().length === 0)
      ) {
        violations.push({
          ruleId: "L-A11Y",
          objectId: id,
          message: "Input has no accessible name (placeholder or ariaLabel)",
          severity: "error",
          path: "props.placeholder",
          suggestion: "Give the input a placeholder or ariaLabel",
        });
      }
    }
    if (obj.type === "button") {
      const label = (obj.props ?? {})["label"];
      if (typeof label !== "string" || label.trim().length === 0) {
        violations.push({
          ruleId: "L-A11Y",
          objectId: id,
          message: "Button has no accessible name",
          severity: "error",
          path: "props.label",
          suggestion: "Give the button a non-empty label",
        });
      }
    }
  }
}

const LOREM = /lorem|ipsum|dolor sit amet|text here|your text here|add text here|placeholder text|xxx+/i;

function checkContent(scene: Scene, violations: LintViolation[]): void {
  const scanText = (id: string, val: unknown, path: string): void => {
    if (typeof val === "string" && LOREM.test(val)) {
      violations.push({
        ruleId: "L-CONTENT",
        objectId: id,
        message: `Placeholder-ish copy at ${path}: "${val.slice(0, 60)}"`,
        severity: "warning",
        path,
        suggestion: "Use realistic copy (real labels, names, data)",
      });
    }
  };
  for (const [id, obj] of Object.entries(scene.objects)) {
    const props = obj.props ?? {};
    scanText(id, props["content"], "props.content");
    scanText(id, props["label"], "props.label");
    scanText(id, props["title"], "props.title");
    scanText(id, props["placeholder"], "props.placeholder");
    if (Array.isArray(props["items"])) {
      (props["items"] as unknown[]).forEach((item, i) => scanText(id, item, `props.items[${i}]`));
    }
  }
}

export const M2_RULES: LintRule[] = [
  { id: "L-TYPE", name: "Type Scale", severity: "warning", check: (scene) => { const v: LintViolation[] = []; checkType(scene, v); return v; } },
  { id: "L-TOKEN", name: "Token References", severity: "warning", check: (scene, locks, profile) => { const v: LintViolation[] = []; checkToken(scene, locks ?? [], v, profile); return v; } },
  { id: "L-STATES", name: "Required States", severity: "error", check: (scene) => { const v: LintViolation[] = []; checkStates(scene, v); return v; } },
  { id: "L-ALIGN", name: "Alignment Edges", severity: "warning", check: (scene) => { const v: LintViolation[] = []; checkAlign(scene, v); return v; } },
  { id: "L-HIER", name: "Hierarchy", severity: "warning", check: (scene) => { const v: LintViolation[] = []; checkHier(scene, v); return v; } },
  { id: "L-A11Y", name: "Accessibility", severity: "error", check: (scene) => { const v: LintViolation[] = []; checkA11y(scene, v); return v; } },
  { id: "L-CONTENT", name: "Content Quality", severity: "warning", check: (scene) => { const v: LintViolation[] = []; checkContent(scene, v); return v; } },
];
