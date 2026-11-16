import { renderIconMarkup } from "./icons.js";
import { styleBlock } from "./style-decl.js";
import { IntentError, ErrorCodes } from "@intent/core";
import type { RenderNode } from "./model.js";

/**
 * trd 13.1/13.2 — single source of truth for RenderModel → static HTML
 * markup. Used by `exportToHtml` (deliverable) and the Studio preview
 * (srcdoc) so the fidelity comparison (AC-M1-07/trd 13.8) is structural, not
 * coincidental: both render from the same model, the same class names and
 * the same stylesheet text.
 */
const MAX_DEPTH = 200;

export const RENDER_MAX_NODES = 5000;

function attrsToString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${escapeHtml(v)}"`)
    .join("");
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

/** Renders one RenderNode and its descendants. Depth/node budgets bound corrupt trees. */
export function renderModelNodeHtml(
  node: RenderNode,
  depth: number = 0,
  budget: { remaining: number } = { remaining: RENDER_MAX_NODES },
  includeDataIds: boolean = true,
): string {
  if (depth > MAX_DEPTH || budget.remaining <= 0) {
    throw new IntentError(ErrorCodes.E_LIMIT, "Scene exceeds render depth/size budget");
  }
  budget.remaining -= 1;
  const indent = "  ".repeat(depth);
  const oid = includeDataIds ? ` data-object-id="${escapeHtml(node.id)}"` : "";
  const styleStr = styleBlock(node.style);
  const styleAttr = styleStr ? ` style="${escapeHtml(styleStr)}"` : "";

  // The icon's SVG is engine-generated from the allowlisted glyph table; the
  // model only carries the allowlisted name and sizing.
  if (node.tag === "span" && node.attrs["data-icon"]) {
    const iconName = node.attrs["data-icon"] ?? "";
    const size = Math.min(Math.max(Number(node.attrs["data-icon-size"] ?? 24) || 24, 1), 256);
    const color =
      typeof node.attrs["data-icon-color"] === "string" && node.attrs["data-icon-color"]
        ? node.attrs["data-icon-color"]
        : "currentColor";
    const label =
      node.attrs["role"] === "img" && typeof node.attrs["aria-label"] === "string"
        ? node.attrs["aria-label"]
        : "";
    return `${indent}${renderIconMarkup(iconName, size, color, label, { objectId: includeDataIds ? node.id : undefined, styleAttr })}`;
  }

  const attrsStr = attrsToString(node.attrs);
  const children = node.children
    .map((child) => renderModelNodeHtml(child, depth + 1, budget, includeDataIds))
    .join("\n");

  // Void elements self-close.
  if (node.tag === "img" || node.tag === "input" || node.tag === "hr") {
    return `${indent}<${node.tag}${attrsStr}${oid}${styleAttr} />`;
  }

  const inner = node.children.length > 0 ? `\n${children}\n${indent}` : escapeHtml(node.text ?? "");
  return `${indent}<${node.tag}${attrsStr}${oid}${styleAttr}>${inner}</${node.tag}>`;
}
