import type { RenderNode } from "./model.js";
import type { DesignProfileLike } from "./tailwind-map.js";
import { IntentError, ErrorCodes } from "@intent/core";

/**
 * trd 13.7 (shadcn half) — map model nodes to imported shadcn components
 * when the design profile provides them. Semantic match:
 *   node.tag === "button"  -> profile.components[].role === "button"
 *   node.tag === "input"   -> profile.components[].role === "input"
 * Everything else falls back to the existing CSS-var renderer.
 *
 * Synthesized control inputs are NOT mapped: the model renders checkbox /
 * radio / switch as a native <input type="checkbox"|"radio"> (or role="switch")
 * inside a label wrapper; those inputs carry the scene's state. Mapping them
 * to the text-oriented shadcn <Input> would silently drop `checked` and the
 * control semantics. Only scene-level (keyboard-focusable, text-entry) inputs
 * map. Roles that are NOT mechanical maps are deliberately unmapped:
 *   - checkbox/radio-group/switch: subtree replacement with controlled
 *     components (checked + onCheckedChange), not a per-node swap;
 *   - select/card: no scene-model tag exists to map them onto;
 *   - dialog: shadcn Dialog is a composed trigger/content pair, not a
 *     drop-in for the scene's <dialog> node;
 *   - textarea: no textarea object type exists in the scene schema,
 *     so no model node ever carries that tag.
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

/** True for the model's synthesized checkbox/radio/switch inner inputs (id `<parent>::input`). */
function isSynthesizedControlInput(node: RenderNode): boolean {
  if (/::(input|track)$/.test(node.id)) return true;
  const type = node.attrs["type"];
  if (type === "checkbox" || type === "radio") return true;
  return node.attrs["role"] === "switch";
}

const SAFE_COMPONENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function exportNameOf(match: { exportName: string }, role: string): string {
  const name = match.exportName;
  if (!SAFE_COMPONENT.test(name)) {
    throw new IntentError(ErrorCodes.E_SCHEMA, `design-profile.json component export name "${name}" (role "${role}") is not a valid JSX identifier`);
  }
  return name;
}

/** Builds the <Button>/<Input> JSX for a node given the matched profile component, or returns null. */
export function mapNodeToShadcn(node: RenderNode, profile: DesignProfileLike | undefined): ShadcnMapped {
  if (!profile) return { imports: [], jsx: null, used: [] };
  const components = (profile as { components?: Array<{ role: string; importPath: string; exportName: string; propMap: Record<string, string> }> }).components ?? [];
  const match = components.find((c) => c.role === node.tag);
  if (!match) return { imports: [], jsx: null, used: [] };
  const name = exportNameOf(match, node.tag);
  const imp = { name, from: match.importPath };

  if (node.tag === "button") {
    const variant = camelClass(node.attrs["class"]) ?? "primary";
    const label = node.text ?? "Button";
    const disabled = node.attrs["disabled"] !== undefined ? " disabled" : "";
    const type = node.attrs["type"] ? ` type={${JSON.stringify(node.attrs["type"])}}` : ' type="button"';
    const jsx = `<${name}${type} variant={${JSON.stringify(variant)}}${disabled}>{${JSON.stringify(label)}}</${name}>`;
    return { imports: [imp], jsx, used: [imp] };
  }

  if (node.tag === "input") {
    if (isSynthesizedControlInput(node)) return { imports: [], jsx: null, used: [] };
    const type = node.attrs["type"] ?? "text";
    const placeholder = node.attrs["placeholder"];
    const aria = node.attrs["aria-label"];
    const required = node.attrs["required"] !== undefined ? " required" : "";
    const disabled = node.attrs["disabled"] !== undefined ? " disabled" : "";
    const attrParts = [`type={${JSON.stringify(type)}}`];
    if (placeholder !== undefined) attrParts.push(`placeholder={${JSON.stringify(placeholder)}}`);
    if (aria !== undefined) attrParts.push(`aria-label={${JSON.stringify(aria)}}`);
    if (node.attrs["value"] !== undefined) attrParts.push(`defaultValue={${JSON.stringify(node.attrs["value"])}}`);
    if (node.attrs["name"] !== undefined) attrParts.push(`name={${JSON.stringify(node.attrs["name"])}}`);
    return { imports: [imp], jsx: `<${name}${attrParts.length ? " " : ""}${attrParts.join(" ")}${required}${disabled} />`, used: [imp] };
  }

  return { imports: [], jsx: null, used: [] };
}
