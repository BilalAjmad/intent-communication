import {
  Scene,
  SceneObject,
  Screen,
  validateScene,
} from "@intent/schema";

type Container = SceneObject & { type: "container"; props: { layout: "flex" | "grid" | "absolute"; gap?: number; padding?: number; direction?: "row" | "column"; align?: "start" | "center" | "end" | "stretch"; justify?: "start" | "center" | "end" | "space-between" | "space-around" } };
type Text = SceneObject & { type: "text"; props: { content: string; fontSize?: number; fontWeight?: number | "normal" | "bold" | "medium" | "light"; color?: string; lineHeight?: number; textAlign?: "left" | "center" | "right" | "justify" } };
type Button = SceneObject & { type: "button"; props: { label: string; variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive"; disabled?: boolean; size?: "sm" | "md" | "lg"; onClick?: string } };
type Input = SceneObject & { type: "input"; props: { placeholder?: string; value?: string; type?: "text" | "email" | "password" | "number" | "tel" | "url"; disabled?: boolean; required?: boolean; onChange?: string } };
type Image = SceneObject & { type: "image"; props: { src: string; alt?: string; fit?: "cover" | "contain" | "fill" | "scale-down" | "none"; width?: number; height?: number } };

export interface NormalizeOptions {
  applyDefaults?: boolean;
  stripUnknownTokens?: boolean;
  ensureRequiredProps?: boolean;
}

export interface NormalizeResult {
  scene: Scene;
  changes: string[];
}

type SceneValue =
  | string
  | number
  | boolean
  | null
  | { $type: "token"; $value: string }
  | Record<string, unknown>
  | unknown[];

export type { SceneValue };

function defaultNormalizeOptions(): Required<NormalizeOptions> {
  return {
    applyDefaults: true,
    stripUnknownTokens: false,
    ensureRequiredProps: true,
  };
}

function isTokenValue(value: SceneValue): boolean {
  return typeof value === "object" && value !== null && "$type" in value && value.$type === "token";
}

function getTokenString(value: SceneValue): string | null {
  if (isTokenValue(value)) {
    return (value as { $type: "token"; $value: string }).$value;
  }
  return null;
}

export function normalizeScene(input: unknown, options: NormalizeOptions = {}): NormalizeResult {
  const opts = { ...defaultNormalizeOptions(), ...options };
  const scene = validateScene(input);
  const changes: string[] = [];

  const objects = { ...scene.objects };

  for (const [id, obj] of Object.entries(objects)) {
    const updatedObj = normalizeObject(obj, objects, opts, changes);
    if (updatedObj !== obj) {
      objects[id] = updatedObj;
    }
  }

  const normalizedScene: Scene = {
    ...scene,
    objects,
    updatedAt: new Date().toISOString(),
  };

  return { scene: normalizedScene, changes };
}

function normalizeObject(
  obj: SceneObject,
  allObjects: Record<string, SceneObject>,
  opts: Required<NormalizeOptions>,
  changes: string[]
): SceneObject {
  let updated: SceneObject = { ...obj };

  if (opts.applyDefaults) {
    updated = applyDefaults(updated, changes);
  }

  if (opts.stripUnknownTokens) {
    updated = stripUnknownTokens(updated, changes);
  }

  if (opts.ensureRequiredProps) {
    updated = ensureRequiredProps(updated, changes);
  }

  return updated;
}

function applyDefaults(obj: SceneObject, changes: string[]): SceneObject {
  switch (obj.type) {
    case "screen": {
      const o = obj as Screen;
      const updated: Screen = {
        id: o.id,
        type: "screen",
        parentId: o.parentId,
        children: o.children,
        props: {
          title: o.props.title ?? "Untitled",
          width: o.props.width ?? 1280,
          height: o.props.height ?? 720,
          background: o.props.background,
        },
        style: { ...o.style },
        meta: o.meta,
      };
      if (o.props.title === undefined) changes.push(`screen.${o.id}: set default title`);
      if (o.props.width === undefined) changes.push(`screen.${o.id}: set default width 1280`);
      if (o.props.height === undefined) changes.push(`screen.${o.id}: set default height 720`);
      return updated;
    }
    case "container": {
      const o = obj as Container;
      const updated: Container = {
        id: o.id,
        type: "container",
        parentId: o.parentId,
        children: o.children,
        props: {
          layout: o.props.layout ?? "flex",
          gap: o.props.gap ?? 0,
          padding: o.props.padding ?? 0,
          direction: o.props.direction,
          align: o.props.align,
          justify: o.props.justify,
        },
        style: { ...o.style },
        meta: o.meta,
      };
      if (o.props.layout === undefined) changes.push(`container.${o.id}: set default layout flex`);
      return updated;
    }
    case "text": {
      const o = obj as Text;
      const updated: Text = {
        id: o.id,
        type: "text",
        parentId: o.parentId,
        children: o.children,
        props: {
          content: o.props.content ?? "",
          fontSize: o.props.fontSize ?? 16,
          fontWeight: o.props.fontWeight ?? "normal",
          lineHeight: o.props.lineHeight ?? 1.5,
          textAlign: o.props.textAlign ?? "left",
          color: o.props.color,
        },
        style: { ...o.style },
        meta: o.meta,
      };
      if (o.props.fontSize === undefined) changes.push(`text.${o.id}: set default fontSize 16`);
      return updated;
    }
    case "button": {
      const o = obj as Button;
      const updated: Button = {
        id: o.id,
        type: "button",
        parentId: o.parentId,
        children: o.children,
        props: {
          label: o.props.label ?? "Button",
          variant: o.props.variant ?? "primary",
          disabled: o.props.disabled ?? false,
          size: o.props.size ?? "md",
          onClick: o.props.onClick,
        },
        style: {
          ...o.style,
          ...(((o.style as Record<string, unknown>)["minWidth"] === undefined) && { minWidth: 44 }),
          ...(((o.style as Record<string, unknown>)["minHeight"] === undefined) && { minHeight: 44 }),
        } as Record<string, SceneValue>,
        meta: o.meta,
      };
      return updated;
    }
    case "input": {
      const o = obj as Input;
      const updated: Input = {
        id: o.id,
        type: "input",
        parentId: o.parentId,
        children: o.children,
        props: {
          placeholder: o.props.placeholder ?? "",
          value: o.props.value ?? "",
          type: o.props.type ?? "text",
          disabled: o.props.disabled ?? false,
          required: o.props.required ?? false,
          onChange: o.props.onChange,
        },
        style: { ...o.style },
        meta: o.meta,
      };
      return updated;
    }
    case "image": {
      const o = obj as Image;
      const updated: Image = {
        id: o.id,
        type: "image",
        parentId: o.parentId,
        children: o.children,
        props: {
          src: o.props.src ?? "",
          alt: o.props.alt ?? "",
          fit: o.props.fit ?? "cover",
          width: o.props.width,
          height: o.props.height,
        },
        style: { ...o.style },
        meta: o.meta,
      };
      if (!o.props.alt) changes.push(`image.${o.id}: set empty alt`);
      return updated;
    }
    default:
      return obj;
  }
}

function stripUnknownTokens(obj: SceneObject, changes: string[]): SceneObject {
  const updated = { ...obj, props: { ...obj.props }, style: { ...obj.style } } as SceneObject;

  const cleanValue = (val: SceneValue, path: string): SceneValue => {
    if (typeof val === "object" && val !== null && "$type" in val && (val as { $type: string }).$type === "token") {
      const token = getTokenString(val);
      if (token && !/^token\.(color|spacing|typography)\./.test(token)) {
        changes.push(`strip unknown token ${token} at ${path}`);
        return "";
      }
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) {
        cleaned[k] = cleanValue(v as SceneValue, `${path}.${k}`);
      }
      return cleaned;
    } else if (Array.isArray(val)) {
      return val.map((v, i) => cleanValue(v as SceneValue, `${path}[${i}]`));
    }
    return val;
  };

  for (const [key, val] of Object.entries(updated.props)) {
    updated.props[key] = cleanValue(val as SceneValue, `props.${key}`);
  }
  for (const [key, val] of Object.entries(updated.style)) {
    updated.style[key] = cleanValue(val as SceneValue, `style.${key}`);
  }

  return updated;
}

function ensureRequiredProps(obj: SceneObject, changes: string[]): SceneObject {
  const updated = { ...obj, props: { ...obj.props } } as SceneObject;

  if (obj.type === "image" && !updated.props.alt) {
    updated.props.alt = "";
    changes.push(`image.${obj.id}: set empty alt`);
  }
  if (obj.type === "screen" && !updated.props.title) {
    updated.props.title = "Untitled";
    changes.push(`screen.${obj.id}: set required title`);
  }

  return updated;
}

export {
  exportToHtml,
  exportSceneToFile,
  renderExportCss,
  buildStyleString,
} from "./html.js";

export type { HtmlExportOptions } from "./html.js";

export {
  escapeHtml,
  escapeJsonForScript,
  sanitizeCssValue,
  sanitizeUrl,
  safeClassToken,
  buildCsp,
} from "./sanitize.js";

export { SCHEMA_VERSION, SCENE_SCHEMA_VERSION } from "@intent/schema";
