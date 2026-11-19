import type { RenderNode } from "./model.js";
import { renderIconJsx } from "./icons.js";
import { mapStyleToClasses, type DesignProfileLike } from "./tailwind-map.js";
import { mapNodeToShadcn, type ShadcnImport } from "./shadcn-map.js";
import { IntentError, ErrorCodes } from "@intent/core";

/**
 * RenderNode (trd 13.1/13.2) → React JSX source. The twin of render-html.ts:
 * same model in, different serializer out. The exported folder carries the
 * exact same DOM shape as the HTML export (class names, structure, attribute
 * set) — pixel fidelity between the two exporters follows from sharing the
 * model, not from coincidence.
 *
 * JSX attribute spelling rules: `class`→`className`, `for`→`htmlFor`,
 * `tabindex`→`tabIndex`; boolean attributes (`checked`, `disabled`, `required`,
 * `open`) become bare booleans; strings are JSON.stringify-escaped into
 * expression containers so scene-derived text can never break out.
 */

const MAX_DEPTH = 200;
export const REACT_MAX_NODES = 5000;

const BOOLEAN_ATTRS = new Set(["disabled", "required", "open"]);
const ATTR_RENAME: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
};

function jsxAttrName(name: string): string {
  return ATTR_RENAME[name] ?? name;
}

function jsxAttrs(attrs: Record<string, string>, tag: string): string {
  const out: string[] = [];
  for (const [rawName, rawValue] of Object.entries(attrs)) {
    if (rawName === "checked") {
      out.push(" defaultChecked");
      continue;
    }
    // React uncontrolled inputs take defaultValue/defaultChecked, never value/checked-as-string.
    if (tag === "input" && rawName === "value") {
      out.push(` defaultValue={${JSON.stringify(rawValue)}}`);
      continue;
    }
    const name = jsxAttrName(rawName);
    if (BOOLEAN_ATTRS.has(rawName)) {
      // Renderers only emit these when truthy; bare JSX boolean === true.
      out.push(` ${name}`);
      continue;
    }
    out.push(` ${name}={${JSON.stringify(rawValue)}}`);
  }
  return out.join("");
}

const VOID_TAGS = new Set(["img", "input", "hr"]);

function styleLiteral(style: Record<string, string>): string {
  const entries = Object.entries(style).map(([key, value]) => {
    const camel = key.startsWith("--")
      ? key
      : key.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    return `${JSON.stringify(camel)}: ${JSON.stringify(value)}`;
  });
  return `{ ${entries.join(", ")} }`;
}

/** Renders one RenderNode and its descendants to JSX. Budgets mirror render-html.ts. */
export function renderModelNodeJsx(
  node: RenderNode,
  depth: number = 0,
  budget: { remaining: number } = { remaining: REACT_MAX_NODES },
  includeDataIds: boolean = false,
  designProfile?: DesignProfileLike,
  collector?: Map<string, ShadcnImport>,
): string {
  if (depth > MAX_DEPTH || budget.remaining <= 0) {
    throw new IntentError(ErrorCodes.E_LIMIT, "Scene exceeds render depth/size budget");
  }
  budget.remaining -= 1;
  const pad = "  ".repeat(depth);
  const oid = includeDataIds && node.id ? ` data-object-id={${JSON.stringify(node.id)}}` : "";
  const { classes: mappedClasses, rest: mappedRest } = mapStyleToClasses(node.style, designProfile);
  const animStyle = includeDataIds ? mappedRest : { ...mappedRest, ...(node.anim ?? {}) };
  const style = Object.keys(animStyle).length > 0 ? ` style={${styleLiteral(animStyle)}}` : "";
  const mergedClass = [node.attrs["class"] ?? "", ...mappedClasses].filter(Boolean).join(" ");
  const attrsForRender = mergedClass ? { ...node.attrs, class: mergedClass } : node.attrs;

  // The icon's SVG is engine-generated from the allowlisted glyph table.
  if (node.tag === "span" && node.attrs["data-icon"]) {
    const size = Math.min(Math.max(Number(node.attrs["data-icon-size"] ?? 24) || 24, 1), 256);
    const color = typeof node.attrs["data-icon-color"] === "string" && node.attrs["data-icon-color"]
      ? node.attrs["data-icon-color"]
      : "currentColor";
    const label =
      node.attrs["role"] === "img" && typeof node.attrs["aria-label"] === "string"
        ? node.attrs["aria-label"]
        : "";
    return `${pad}${renderIconJsx(node.attrs["data-icon"], size, color, label, {
      objectId: includeDataIds ? node.id : undefined,
      styleObject: Object.keys(animStyle).length > 0 ? styleLiteral(animStyle) : undefined,
      className: mergedClass || undefined,
    })}`;
  }

  // trd 13.7 (shadcn half): map button/input roles to the profile's imported components
  // when the profile provides them. Selection identifiers still flow in via data-object-id.
  if (designProfile) {
    const mapped = mapNodeToShadcn(node, designProfile);
    if (mapped.jsx) {
      for (const imp of mapped.used) collector?.set(`${imp.name}::${imp.from}`, imp);
      const dataIdAttr = includeDataIds && node.id ? ` data-object-id={${JSON.stringify(node.id)}}` : "";
      const injected = mapped.jsx.replace(/^<(\w+)/, (_, tag) => `<${tag}${dataIdAttr}`);
      return `${pad}${injected}`;
    }
  }

  const attrs = jsxAttrs(attrsForRender, node.tag);

  if (VOID_TAGS.has(node.tag)) {
    return `${pad}<${node.tag}${attrs}${oid}${style} />`;
  }

  const children = node.children
    .map((child) => renderModelNodeJsx(child, depth + 1, budget, includeDataIds, designProfile, collector))
    .join("\n");

  const text = node.text !== undefined ? `{${JSON.stringify(node.text)}}` : "";
  const inner = node.children.length > 0 ? `\n${children}\n${pad}` : text;
  return `${pad}<${node.tag}${attrs}${oid}${style}>${inner}</${node.tag}>`;
}
