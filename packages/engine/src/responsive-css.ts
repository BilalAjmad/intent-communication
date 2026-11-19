import type { Scene, ResponsiveOverride, Breakpoints } from "@intent/schema";
import { styleDeclarations, resolveSceneValue } from "./style-decl.js";
import { sanitizeCssValue } from "./sanitize.js";
import { reachableObjectIds } from "./reachability.js";

/**
 * trd 4.4 Responsive override CSS. Mobile-first: the scene's base values apply
 * to all widths; these rules layer min-width overrides on top in source order
 * (sm, then md, then lg), so larger breakpoints win ties at equal specificity.
 *
 * Override fields map to CSS as follows (all declarations pass the closed CSS
 * value grammar where they carry user data):
 *   style    → the sanitized declarations, unchanged
 *   layout   → display/flex-direction/gap/padding/align-items/justify-content
 *              (fixed enums only, never user strings)
 *   size     → width/height (numbers become clamped px; strings through the
 *              CSS value grammar)
 *   position → position:absolute + left/top from x/y
 *   visible  → display:none when false (true adds no rule; base shows)
 */
export const DEFAULT_BREAKPOINTS: Breakpoints = { sm: 640, md: 1024, lg: 1440 };

// Instance-derived ids look like "instance::inner" — the colon is safe inside a quoted attribute selector.
const SAFE_OBJECT_ID = /^[A-Za-z0-9_:-]+$/;

const ALIGN_ITEMS: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};
const JUSTIFY_CONTENT: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  "space-between": "space-between",
  "space-around": "space-around",
};

function clampPx(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.floor(value), 0), 10000);
}

function sizeToCss(value: number | string): string | null {
  if (typeof value === "number") return `${clampPx(value)}px`;
  // Route string sizes through the same token resolution as `style` values,
  // so token.spacing.* works in responsive overrides (wireframe of size).
  const resolved = resolveSceneValue(value);
  const safe = sanitizeCssValue(resolved);
  return safe || null;
}

function pxFromUnknown(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.trunc(value)}px`;
  }
  return null;
}

/** Declarations for one responsive override (used by renderResponsiveCss and the RenderModel normalizer). */
export function responsiveDeclarations(override: ResponsiveOverride): string[] {
  const decls: string[] = [];

  if (override.style) {
    decls.push(...styleDeclarations(override.style).map(([prop, value]) => `${prop}: ${value}`));
  }

  const layout = override.layout;
  if (layout) {
    if (layout.layout) {
      decls.push(layout.layout === "grid" ? "display: grid" : layout.layout === "absolute" ? "position: absolute" : "display: flex");
    }
    if (layout.direction) decls.push(`flex-direction: ${layout.direction}`);
    if (layout.gap !== undefined) decls.push(`gap: ${clampPx(layout.gap)}px`);
    if (layout.padding !== undefined) decls.push(`padding: ${clampPx(layout.padding)}px`);
    if (layout.align) decls.push(`align-items: ${ALIGN_ITEMS[layout.align] ?? "stretch"}`);
    if (layout.justify) decls.push(`justify-content: ${JUSTIFY_CONTENT[layout.justify] ?? "flex-start"}`);
  }

  const size = override.size;
  if (size) {
    if (size.width !== undefined) {
      const w = sizeToCss(size.width);
      if (w) decls.push(`width: ${w}`);
    }
    if (size.height !== undefined) {
      const h = sizeToCss(size.height);
      if (h) decls.push(`height: ${h}`);
    }
  }

  const position = override.position;
  if (position) {
    const left = pxFromUnknown(position.x);
    const top = pxFromUnknown(position.y);
    if (left || top) {
      decls.push("position: absolute");
      if (left) decls.push(`left: ${left}`);
      if (top) decls.push(`top: ${top}`);
    }
  }

  if (override.visible === false) {
    decls.push("display: none");
  }

  return decls;
}

/** Returns @media blocks (sm, md, lg) with override rules for a validated scene. */
export function renderResponsiveCss(
  scene: Scene,
  breakpoints: Breakpoints = DEFAULT_BREAKPOINTS,
): string {
  const order = [
    ["sm", breakpoints.sm],
    ["md", breakpoints.md],
    ["lg", breakpoints.lg],
  ] as const;
  const lines: string[] = [];
  const reachable = reachableObjectIds(scene);
  for (const [key, minWidth] of order) {
    const rules: string[] = [];
    for (const obj of Object.values(scene.objects)) {
      if (!obj || typeof obj !== "object") continue;
      if (!reachable.has(obj.id)) continue; // def-source nodes render nothing — no CSS for them
      if (!SAFE_OBJECT_ID.test(obj.id)) continue;
      const override = obj.responsive?.[key];
      if (!override) continue;
      const decls = responsiveDeclarations(override);
      if (decls.length > 0) {
        rules.push(`[data-object-id="${obj.id}"] { ${decls.join(" ")} }`);
      }
    }
    if (rules.length > 0) {
      const safeMinWidth = Number.isFinite(minWidth) && minWidth > 0 ? Math.floor(minWidth) : DEFAULT_BREAKPOINTS.sm;
      lines.push(`@media (min-width: ${Math.max(1, safeMinWidth)}px) {`);
      for (const rule of rules) {
        lines.push(`  ${rule}`);
      }
      lines.push("}");
    }
  }
  return lines.join("\n");
}
