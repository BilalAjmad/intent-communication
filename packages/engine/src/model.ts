import { Scene, SceneObject, validateScene } from "@intent/schema";
import type { Keyframes } from "@intent/schema";
import { IntentError, ErrorCodes } from "@intent/core";
import { expandComponentInstances } from "./components.js";
import { styleDeclarations, resolveSceneValue } from "./style-decl.js";
import { sanitizeKeyframes } from "./keyframes.js";
import { responsiveDeclarations } from "./responsive-css.js";
import { sanitizeUrl, sanitizeImageSrc, safeClassToken } from "./sanitize.js";
import { sanitizeCssValue } from "./sanitize.js";
import { LIGHT_VARS, DARK_VARS } from "./vars.js";
import { DEFAULT_BREAKPOINTS } from "./responsive-css.js";
import type { Breakpoints } from "@intent/schema";

/**
 * trd 13.1/13.2 — the RenderModel. Pure normalization of a validated Scene
 * into a renderer-neutral tree. Both exporters (HTML, React) and the Studio
 * preview consume this model; nothing else walks the raw scene graph.
 *
 * Determinism: no clock, no randomness, no environment input; screens keep
 * `screenOrder` (leftovers appended by id); derived-id clones for instances.
 */

export interface RenderNode {
  id: string;
  tag: string;
  attrs: Record<string, string>;
  text?: string;
  style: Record<string, string>;
  /** Animation/transition declarations (trd 13.6) — emitted inside @media (prefers-reduced-motion: no-preference), never inline. */
  anim?: Record<string, string>;
  bp: { sm?: Record<string, string>; md?: Record<string, string>; lg?: Record<string, string> };
  states: Record<string, Record<string, string>>;
  interactions: { event: "click" | "change" | "submit"; action: string }[];
  children: RenderNode[];
}

export interface RenderModel {
  formatVersion: 1;
  title: string;
  startScreenId: string;
  vars: { light: Record<string, string>; dark: Record<string, string> };
  breakpoints: { sm: number; md: number; lg: number };
  screens: { id: string; name: string; root: RenderNode }[];
  /** Scene keyframes (trd 13.6), sanitized at normalization; emitted inside the reduced-motion media block. */
  keyframes?: Keyframes;
}

const MAX_DEPTH = 200;
const MAX_NODES = 5000;

const ALLOWED_TAGS = new Set([
  "main", "section", "nav", "header", "footer", "form", "ul", "li", "ol",
  "p", "span", "h1", "h2", "h3", "h4", "h5", "h6",
  "button", "input", "textarea", "label", "img", "svg", "div", "dialog", "hr", "a",
]);

/** Attribute names allowed by trd 13.4 plus the structural markers every exporter emits. */
const ALLOWED_ATTRS = new Set([
  "id", "class", "role",
  "aria-label", "aria-hidden", "aria-describedby", "aria-live",
  "alt", "src", "type", "name", "placeholder", "value",
  "required", "disabled", "for", "href", "rel", "target",
  "data-state", "data-oid", "data-screen-id", "tabindex", "open", "data-icon", "data-icon-size", "data-icon-color", "checked",
]);

/** Maps a scene object type to the tag used in the model. */
const TAG_FOR: Record<string, string> = {
  screen: "main",
  container: "div",
  text: "p",
  button: "button",
  input: "input",
  image: "img",
  checkbox: "label",
  radio: "label",
  switch: "label",
  link: "a",
  list: "ul",
  modal: "dialog",
  icon: "span",
  divider: "hr",
};

function assertNodeTag(tag: string): void {
  if (!ALLOWED_TAGS.has(tag)) {
    throw new IntentError(ErrorCodes.E_SCHEMA, `RenderModel produced a disallowed tag: ${tag}`);
  }
}

function assertNodeAttrs(attrs: Record<string, string>): Record<string, string> {
  for (const name of Object.keys(attrs)) {
    if (!ALLOWED_ATTRS.has(name)) {
      throw new IntentError(ErrorCodes.E_SCHEMA, `RenderModel produced a disallowed attribute: ${name}`);
    }
  }
  return attrs;
}

function styleRecord(style: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [prop, value] of styleDeclarations(style)) {
    out[prop] = value;
  }
  return out;
}

/** Animation/transition keys (trd 13.6) that must never render inline. */
const ANIMATION_PROPS = new Set([
  "transition", "transition-property", "transition-duration", "transition-timing-function", "transition-delay",
  "animation", "animation-name", "animation-duration", "animation-timing-function", "animation-delay",
  "animation-iteration-count", "animation-fill-mode", "animation-direction", "animation-play-state",
]);

/** Splits off animation declarations (they render inside prefers-reduced-motion rules). */
function splitAnim(style: Record<string, string>): { anim: Record<string, string> | undefined; rest: Record<string, string> } {
  const anim: Record<string, string> = {};
  const rest: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    if (ANIMATION_PROPS.has(key)) anim[key] = value;
    else rest[key] = value;
  }
  return { anim: Object.keys(anim).length > 0 ? anim : undefined, rest };
}

/** Parses a declaration block ("a: b; c: d;") into a record. Splits only on "; " and the first ": ". */
function declsToRecord(decls: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of decls) {
    const idx = decl.indexOf(": ");
    if (idx <= 0) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 2).trim();
    if (prop && value) out[prop] = value;
  }
  return out;
}

function collectInteractions(props: Record<string, unknown>): RenderNode["interactions"] {
  const out: RenderNode["interactions"] = [];
  if (typeof props["onClick"] === "string" && props["onClick"]) {
    out.push({ event: "click", action: String(props["onClick"]).slice(0, 1000) });
  }
  if (typeof props["onChange"] === "string" && props["onChange"]) {
    out.push({ event: "change", action: String(props["onChange"]).slice(0, 1000) });
  }
  if (typeof props["onSubmit"] === "string" && props["onSubmit"]) {
    out.push({ event: "submit", action: String(props["onSubmit"]).slice(0, 1000) });
  }
  return out;
}

function nodeFor(
  obj: SceneObject,
  allObjects: Record<string, SceneObject>,
  depth: number,
  budget: { remaining: number },
): RenderNode {
  if (depth > MAX_DEPTH || budget.remaining <= 0) {
    throw new IntentError(ErrorCodes.E_LIMIT, "Scene exceeds render depth/size budget");
  }
  budget.remaining -= 1;

  const props = (obj.props ?? {}) as Record<string, unknown>;
  const tag = TAG_FOR[obj.type] ?? "div";
  assertNodeTag(tag);

  const classAttr: Record<string, string> = { class: classFor(obj) };
  const attrs: Record<string, string> = assertNodeAttrs(classAttr);

  const baseRecord = styleRecord(obj.style);
  const { anim, rest } = splitAnim(baseRecord);

  const node: RenderNode = {
    id: obj.id,
    tag,
    attrs,
    style: rest,
    ...(anim ? { anim } : {}),
    bp: {},
    states: {},
    interactions: collectInteractions(props),
    children: [],
  };

  // Responsive overrides (trd 4.4).
  for (const key of ["sm", "md", "lg"] as const) {
    const override = obj.responsive?.[key];
    if (!override) continue;
    node.bp[key] = declsToRecord(responsiveDeclarations(override));
  }

  // State overrides (trd 5.3).
  for (const [name, override] of Object.entries(obj.states ?? {})) {
    const rec = styleRecord(override?.style);
    if (override?.visible === false) rec["display"] = "none";
    if (Object.keys(rec).length > 0) node.states[name] = rec;
  }

  // Per-type semantics (tags, attrs, text, children).
  const childrenIds = obj.children ?? [];
  const childNodes = () =>
    childrenIds
      .map((id) => allObjects[id])
      .filter((c): c is SceneObject => Boolean(c))
      .map((c) => nodeFor(c, allObjects, depth + 1, budget));

  // Leaf node types carry no children — silently dropping them would produce
  // empty elements with hidden interactive subtrees. Fail loud instead.
  const LEAF_TYPES = new Set(["text", "button", "input", "image", "link", "icon", "divider"]);
  if (LEAF_TYPES.has(obj.type) && (obj.children ?? []).length > 0) {
    throw new IntentError(ErrorCodes.E_SCHEMA, `${obj.type} object ${obj.id} declares children — leaf node types never render children`);
  }

  switch (obj.type) {
    case "screen": {
      node.attrs["data-screen-id"] = obj.id;
      node.children = childNodes();
      break;
    }
    case "container": {
      node.children = childNodes();
      break;
    }
    case "text": {
      const content = props["content"];
      node.text =
        typeof content === "string"
          ? content
          : content === null || content === undefined
            ? ""
            : String(content);
      break;
    }
    case "button": {
      node.attrs["type"] = "button";
      if (props["disabled"] === true) node.attrs["disabled"] = "";
      node.text = typeof props["label"] === "string" ? props["label"] : "Button";
      break;
    }
    case "input": {
      const rawType = typeof props["type"] === "string" ? props["type"] : "text";
      const inputType = ["text", "email", "password", "number", "tel", "url"].includes(rawType) ? rawType : "text";
      node.attrs["type"] = inputType;
      const placeholder = typeof props["placeholder"] === "string" ? props["placeholder"] : "";
      node.attrs["placeholder"] = placeholder;
      node.attrs["aria-label"] = placeholder || "Input";
      const value = typeof props["value"] === "string" ? props["value"] : "";
      if (value) node.attrs["value"] = value;
      if (props["required"] === true) node.attrs["required"] = "";
      if (props["disabled"] === true) node.attrs["disabled"] = "";
      break;
    }
    case "image": {
      const src = sanitizeImageSrc(props["src"]);
      node.attrs["src"] = src;
      node.attrs["alt"] = typeof props["alt"] === "string" ? props["alt"] : "";
      break;
    }
    case "checkbox":
    case "radio":
    case "switch": {
      const inputType = obj.type === "radio" ? "radio" : "checkbox";
      const label = typeof props["label"] === "string" ? props["label"] : obj.type === "checkbox" ? "Checkbox" : obj.type === "radio" ? "Option" : "Toggle";
      const name = typeof props["name"] === "string" && props["name"] ? props["name"] : "";
      const value = typeof props["value"] === "string" && props["value"] ? props["value"] : "";
      const inputNode: RenderNode = {
        id: `${obj.id}::input`,
        tag: "input",
        attrs: assertNodeAttrs({
          type: inputType,
          ...(name ? { name } : {}),
          ...(value ? { value } : {}),
          ...(props["checked"] === true ? { checked: "checked" } : {}),
          ...(props["disabled"] === true ? { disabled: "" } : {}),
          ...(obj.type === "switch" ? { role: "switch" } : {}),
        }),
        style: {},
        bp: {},
        states: {},
        interactions: node.interactions,
        children: [],
      };
      const childrenOut: RenderNode[] = [inputNode];
      if (obj.type === "switch") {
        childrenOut.push({
          id: `${obj.id}::track`,
          tag: "span",
          attrs: assertNodeAttrs({ class: "switch-track" }),
          style: {},
          bp: {},
          states: {},
          interactions: [],
          children: [],
        });
      }
      childrenOut.push({
        id: `${obj.id}::label`,
        tag: "span",
        attrs: assertNodeAttrs({}),
        text: label,
        style: {},
        bp: {},
        states: {},
        interactions: [],
        children: [],
      });
      node.children = childrenOut;
      node.text = undefined;
      break;
    }
    case "link": {
      const href = sanitizeUrl(props["href"]);
      if (href) node.attrs["href"] = href;
      const target = typeof props["target"] === "string" ? safeClassToken(props["target"], "_self") : "_self";
      if (target !== "_self") node.attrs["target"] = target;
      const SAFE_REL = new Set(["noopener", "noreferrer", "nofollow"]);
      const rawRel = typeof props["rel"] === "string" ? props["rel"] : "";
      const rels = rawRel.split(/\s+/).filter((t) => SAFE_REL.has(t));
      if (target === "_blank" && !rels.includes("noopener")) rels.push("noopener");
      if (rels.length) node.attrs["rel"] = rels.join(" ");
      node.text = typeof props["label"] === "string" ? props["label"] : "Link";
      break;
    }
    case "list": {
      const ordered = props["ordered"] === true;
      const items = Array.isArray(props["items"]) ? (props["items"] as unknown[]) : [];
      node.tag = ordered ? "ol" : "ul";
      assertNodeTag(node.tag);
      node.children = items.slice(0, 100).map((item, i) => ({
        id: `${obj.id}::li-${i}`,
        tag: "li",
        attrs: assertNodeAttrs({}),
        text: typeof item === "string" ? item : String(item ?? ""),
        style: {},
        bp: {},
        states: {},
        interactions: [],
        children: [],
      }));
      break;
    }
    case "modal": {
      const size = safeClassToken(props["size"], "md");
      node.attrs["class"] = size === "md" ? "intent-modal" : `intent-modal intent-modal-${size}`;
      if (props["open"] === true) node.attrs["open"] = "";
      const title = typeof props["title"] === "string" ? props["title"] : "";
      if (title) node.attrs["aria-label"] = title;
      const inner = childNodes();
      if (title) {
        inner.unshift({
          id: `${obj.id}::title`,
          tag: "h2",
          attrs: assertNodeAttrs({ class: "intent-modal-title" }),
          text: title,
          style: {},
          bp: {},
          states: {},
          interactions: [],
          children: [],
        });
      }
      node.children = inner;
      break;
    }
    case "icon": {
      const label = typeof props["label"] === "string" && props["label"].trim() ? props["label"].trim() : "";
      if (label) {
        node.attrs["role"] = "img";
        node.attrs["aria-label"] = label;
      } else {
        node.attrs["aria-hidden"] = "true";
      }
      const iconName = typeof props["icon"] === "string" ? props["icon"].trim().toLowerCase() : "";
      node.attrs["data-icon"] = iconName;
      const rawSize = typeof props["size"] === "number" && Number.isFinite(props["size"]) ? Math.floor(props["size"]) : 24;
      node.attrs["data-icon-size"] = String(Math.min(Math.max(rawSize, 1), 256));
      const color = resolveSceneValue(props["color"]);
      const safeColor = color ? sanitizeCssValue(color) : "";
      if (safeColor) node.attrs["data-icon-color"] = safeColor;
      break;
    }
    case "divider": {
      node.attrs["role"] = "separator";
      const thicknessRaw = typeof props["thickness"] === "number" && Number.isFinite(props["thickness"]) ? props["thickness"] : 1;
      const thickness = Math.min(Math.max(Math.floor(thicknessRaw), 1), 32);
      const direction = props["direction"] === "vertical" ? "vertical" : "horizontal";
      node.style = { ...node.style, ...(direction === "horizontal" ? { height: `${thickness}px` } : { width: `${thickness}px` }) };
      break;
    }
    default: {
      node.children = childNodes();
    }
  }

  return node;
}

function classFor(obj: SceneObject): string {
  switch (obj.type) {
    case "screen": return "intent-screen";
    case "container": return "intent-container";
    case "text": return "intent-text";
    case "button": return `intent-button intent-button-${safeClassToken((obj.props as Record<string, unknown>)["variant"], "primary")}`;
    case "input": return "intent-input";
    case "image": return `intent-image intent-fit-${safeClassToken((obj.props as Record<string, unknown>)["fit"], "cover")}`;
    case "checkbox": return "intent-checkbox";
    case "radio": return "intent-radio";
    case "switch": return "intent-switch";
    case "link": return "intent-link";
    case "list": return "intent-list";
    case "modal": return "intent-modal";
    case "icon": return "intent-icon";
    case "divider": {
      const direction = (obj.props as Record<string, unknown>)["direction"] === "vertical" ? "vertical" : "horizontal";
      return `intent-divider intent-divider-${direction}`;
    }
    default: return "intent-object";
  }
}

function assertAcyclic(objects: Record<string, SceneObject>, roots: string[]): void {
  // Objects reachable from any root are traversed with a path-aware set so a
  // hostile cycle (A → B → A) is rejected with E_LIMIT instead of recursing forever.
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const walk = (id: string, depth: number): void => {
    if (depth > MAX_DEPTH) {
      throw new IntentError(ErrorCodes.E_LIMIT, "Scene exceeds render depth budget");
    }
    if (inStack.has(id)) {
      throw new IntentError(ErrorCodes.E_LIMIT, "Scene contains a cycle");
    }
    if (visited.has(id)) return;
    visited.add(id);
    inStack.add(id);
    const obj = objects[id];
    for (const child of obj?.children ?? []) {
      walk(child, depth + 1);
    }
    inStack.delete(id);
  };
  for (const root of roots) walk(root, 0);
  // Unreachable cycles are still hostile input; validate every leftover object too.
  for (const id of Object.keys(objects)) walk(id, 0);
}

export interface RenderModelOptions {
  breakpoints?: Breakpoints;
}

/** Pure normalization of a scene into the RenderModel (trd 13.1/13.2). */
export function normalizeSceneToModel(scene: Scene, options: RenderModelOptions = {}): RenderModel {
  const validated = validateScene(scene);
  const renderScene = expandComponentInstances(validated);
  const breakpoints = options.breakpoints ?? DEFAULT_BREAKPOINTS;

  const orderedIds = validated.screenOrder.filter((id) => validated.screens[id]);
  const leftover = Object.keys(validated.screens).filter((id) => !orderedIds.includes(id)).sort();
  const allIds = [...orderedIds, ...leftover];

  assertAcyclic(renderScene.objects, allIds);

  const budget = { remaining: MAX_NODES };
  const allObjects: Record<string, SceneObject> = { ...renderScene.objects };
  const screens = allIds.map((id) => {
    const screenObj = renderScene.objects[id];
    const screen = validated.screens[id];
    if (!screen) {
      throw new IntentError(ErrorCodes.E_SCHEMA, `Screen ${id} is missing from the scene`);
    }
    const root = (screenObj ?? screen) as SceneObject;
    return {
      id,
      name: typeof screen.props.title === "string" && screen.props.title ? screen.props.title : "Untitled",
      root: nodeFor(root, allObjects, 0, budget),
    };
  });

  const startScreenId = allIds[0] ?? "";
  const keyframes = sanitizeKeyframes(validated.metadata?.keyframes);

  return {
    formatVersion: 1,
    title: validated.metadata.name ?? "Untitled Project",
    startScreenId,
    ...(keyframes ? { keyframes } : {}),
    vars: {
      light: { ...LIGHT_VARS },
      dark: { ...DARK_VARS },
    },
    breakpoints: { sm: breakpoints.sm, md: breakpoints.md, lg: breakpoints.lg },
    screens,
  };
}
