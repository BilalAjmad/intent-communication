import type { RenderNode, RenderModel } from "./model.js";

/**
 * trd 13.6 — animations and transitions are emitted ONLY inside
 * `@media (prefers-reduced-motion: no-preference)` blocks. The base
 * stylesheet already neutralizes motion under `prefers-reduced-motion:
 * reduce`; this module is the second half of that contract: users who have
 * not expressed a preference get transitions, users who have get none.
 *
 * Scope: scene-wide @keyframes (model.keyframes, trd 13.6) and base-style
 * animation/transition declarations on a node (the only ones the model splits
 * out). Transitions declared inside `states` style overrides are not split and
 * render inside state CSS unchanged — documented limitation; the reduce guard
 * covers them too. The @keyframes block is emitted even when includeDataIds is
 * false (it is a static definition, not a data-id-scoped selector).
 *
 * Selectors use the node's data-object-id, so this block is only useful when
 * the exporter emits includeDataIds: true (plain HTML export default). When
 * includeDataIds is false, the declarations are kept inline instead of being
 * silently dropped (see renderAnimationCss signature note).
 */

export interface AnimationCssOptions {
  /** When false, animations are left inline (documented fallback) and no media block is emitted. */
  includeDataIds: boolean;
}

const SAFE_OBJECT_ID = /^[A-Za-z0-9_-]+$/;

function collect(node: RenderNode, out: Map<string, Record<string, string>>): void {
  if (node.anim && SAFE_OBJECT_ID.test(node.id)) {
    out.set(node.id, node.anim);
  }
  for (const child of node.children) collect(child, out);
}

const SAFE_NAME = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
const SAFE_OFFSET = /^(from|to|(100|[0-9]{1,2})(\.\d+)?%)$/;

function offsetSortKey(offset: string): number {
  if (offset === "from") return -1;
  if (offset === "to") return 101;
  return Number(offset.replace("%", ""));
}

/** Emits the scene @keyframes (already sanitized in the model), sorted for determinism. */
function renderKeyframes(model: RenderModel): string[] {
  const table = model.keyframes;
  if (!table) return [];
  const lines: string[] = [];
  for (const name of Object.keys(table).sort((a, b) => a.localeCompare(b))) {
    if (!SAFE_NAME.test(name)) continue;
    const steps = table[name];
    if (!steps) continue;
    const offsets = Object.keys(steps).filter((o) => SAFE_OFFSET.test(o)).sort((a, b) => offsetSortKey(a) - offsetSortKey(b));
    if (offsets.length === 0) continue;
    lines.push(`  @keyframes ${name} {`);
    for (const offset of offsets) {
      const decls = Object.entries(steps[offset]!)
        .map(([prop, value]) => `${prop}: ${value};`)
        .join(" ");
      if (decls) lines.push(`    ${offset} { ${decls} }`);
    }
    lines.push("  }");
  }
  return lines;
}

export function renderAnimationCss(model: RenderModel, options: AnimationCssOptions): string {
  const keyframeLines = renderKeyframes(model);
  if (!options.includeDataIds) {
    // Animations themselves fall back to inline (documented); keyframes are
    // static definitions and are safe (and needed) to emit either way.
    return keyframeLines.length > 0 ? ["@media (prefers-reduced-motion: no-preference) {", ...keyframeLines, "}"].join("\n") : "";
  }
  const rules = new Map<string, Record<string, string>>();
  for (const screen of model.screens) {
    collect(screen.root, rules);
  }
  if (rules.size === 0 && keyframeLines.length === 0) return "";
  const lines = ["@media (prefers-reduced-motion: no-preference) {"];
  lines.push(...keyframeLines);
  for (const [id, anim] of [...rules.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const decls = Object.entries(anim)
      .map(([prop, value]) => `${prop}: ${value};`)
      .join(" ");
    lines.push(`  [data-object-id="${id}"] { ${decls} }`);
  }
  lines.push("}");
  return lines.join("\n");
}
