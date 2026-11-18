import type { RenderNode } from "./model.js";
import type { DesignProfileLike } from "./tailwind-map.js";

/**
 * trd 13.7 (shadcn half) — map model nodes to imported shadcn components
 * when the design profile provides them. Semantic match:
 *   node.tag === "button"  -> profile.components[].role === "button"
 *   node.tag === "input"   -> profile.components[].role === "input"
 * Everything else falls back to the existing CSS-var renderer.
 */

export interface ShadcnImport {
  name: string;
  from: string;
}

export interface ShadcnMapped {
  /** Names to import, sorted/deduped by the caller. */
  imports: ShadcnImport[];
  /** JSX fragment for this node (empty if no role matched). */
  jsx: string | null;
  /** The component used, for the caller to collect imports. */
  used: ShadcnImport[];
}

function camelClass(cls: string | undefined): string | null {
  if (!cls) return null;
  const match = /\bintent-button-([a-z]+)\b/.exec(cls);
  return match ? match[1]! : null;
}

/** Builds the <Button>/<Input> JSX for a node given the matched profile component, or returns null. */
export function mapNodeToShadcn(node: RenderNode, profile: DesignProfileLike | undefined): ShadcnMapped {
  if (!profile) return { imports: [], jsx: null, used: [] };
  const components = (profile as { components?: Array<{ role: string; importPath: string; exportName: string; propMap: Record<string, string> }> }).components ?? [];
  const match = components.find((c) => c.role === node.tag);
  if (!match) return { imports: [], jsx: null, used: [] };
  const imp = { name: match.exportName, from: match.importPath };

  if (node.tag === "button") {
    const variant = camelClass(node.attrs["class"]) ?? "primary";
    const label = node.text ?? "Button";
    const disabled = node.attrs["disabled"] !== undefined ? " disabled" : "";
    const type = node.attrs["type"] ? ` type={${JSON.stringify(node.attrs["type"])}}` : ' type="button"';
    const jsx = `<Button${type} variant={${JSON.stringify(variant)}}${disabled}>{${JSON.stringify(label)}}</Button>`;
    return { imports: [imp], jsx, used: [imp] };
  }

  if (node.tag === "input") {
    const type = node.attrs["type"] ?? "text";
    const placeholder = node.attrs["placeholder"];
    const aria = node.attrs["aria-label"];
    const required = node.attrs["required"] !== undefined ? " required" : "";
    const disabled = node.attrs["disabled"] !== undefined ? " disabled" : "";
    const attrParts = [`type={${JSON.stringify(type)}}`];
    if (placeholder !== undefined) attrParts.push(`placeholder={${JSON.stringify(placeholder)}}`);
    if (aria !== undefined) attrParts.push(`aria-label={${JSON.stringify(aria)}}`);
    return { imports: [imp], jsx: `<Input${attrParts.length ? " " : ""}${attrParts.join(" ")}${required}${disabled} />`, used: [imp] };
  }

  return { imports: [], jsx: null, used: [] };
}
