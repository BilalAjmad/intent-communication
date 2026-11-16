import type { RenderNode, RenderModel } from "./model.js";

/**
 * trd 13.6 — animations and transitions are emitted ONLY inside
 * `@media (prefers-reduced-motion: no-preference)` blocks. The base
 * stylesheet already neutralizes motion under `prefers-reduced-motion:
 * reduce`; this module is the second half of that contract: users who have
 * not expressed a preference get transitions, users who have get none.
 *
 * Scope: base-style animation/transition declarations on a node (the only
 * ones the model splits out). Transitions declared inside `states` style
 * overrides are not split and render inside state CSS unchanged — documented
 * limitation; the reduce guard covers them too.
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

export function renderAnimationCss(model: RenderModel, options: AnimationCssOptions): string {
  if (!options.includeDataIds) return "";
  const rules = new Map<string, Record<string, string>>();
  for (const screen of model.screens) {
    collect(screen.root, rules);
  }
  if (rules.size === 0) return "";
  const lines = ["@media (prefers-reduced-motion: no-preference) {"];
  for (const [id, anim] of [...rules.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const decls = Object.entries(anim)
      .map(([prop, value]) => `${prop}: ${value};`)
      .join(" ");
    lines.push(`  [data-object-id="${id}"] { ${decls} }`);
  }
  lines.push("}");
  return lines.join("\n");
}
