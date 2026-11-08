import {
  Scene,
  SceneObject,
  Screen,
  validateScene,
  SCHEMA_VERSION,
  SCENE_SCHEMA_VERSION,
} from "@intent/schema";
import { lintScene } from "@intent/linter";

type Container = SceneObject & { type: "container"; props: { layout: "flex" | "grid" | "absolute"; gap?: number; padding?: number; direction?: "row" | "column"; align?: "start" | "center" | "end" | "stretch"; justify?: "start" | "center" | "end" | "space-between" | "space-around" } };
type Text = SceneObject & { type: "text"; props: { content: string; fontSize?: number; fontWeight?: number | "normal" | "bold" | "medium" | "light"; color?: any; lineHeight?: number; textAlign?: "left" | "center" | "right" | "justify" } };
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

export interface HtmlExportOptions {
  includeStyles?: boolean;
  includeScripts?: boolean;
  inlineAssets?: boolean;
  basePath?: string;
  cspNonce?: string;
}

type SceneValue =
  | string
  | number
  | boolean
  | null
  | { $type: "token"; $value: string }
  | Record<string, unknown>
  | unknown[];

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
          minWidth: o.style["minWidth"] ?? 44,
          minHeight: o.style["minHeight"] ?? 44,
        },
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
      return updated;
    }

    default:
      return obj;
  }
}

function stripUnknownTokens(obj: SceneObject, changes: string[]): SceneObject {
  const updated = { ...obj, props: { ...obj.props }, style: { ...obj.style } } as SceneObject;

  const cleanValue = (val: SceneValue, path: string): SceneValue => {
    if (isTokenValue(val)) {
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, "\u0022")
    .replace(/'/g, "&#039;");
}

function tokenToCssVar(token: string): string {
  if (token.startsWith("token.color.")) {
    return `var(--intent-color-${token.slice("token.color.".length)})`;
  }
  if (token.startsWith("token.spacing.")) {
    return `var(--intent-spacing-${token.slice("token.spacing.".length)})`;
  }
  if (token.startsWith("token.typography.")) {
    return `var(--intent-typography-${token.slice("token.typography.".length)})`;
  }
  return token;
}

function resolveValue(val: SceneValue): string {
  if (isTokenValue(val)) {
    return tokenToCssVar(getTokenString(val)!);
  }
  if (typeof val === "string") {
    return val;
  }
  if (typeof val === "number") {
    return `${val}px`;
  }
  if (typeof val === "boolean") {
    return val ? "true" : "false";
  }
  return "";
}

function buildStyleString(style: Record<string, SceneValue>): string {
  const declarations: string[] = [];
  for (const [key, val] of Object.entries(style)) {
    const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    const value = resolveValue(val);
    if (value) {
      declarations.push(`${cssKey}: ${value};`);
    }
  }
  return declarations.join(" ");
}

function renderObject(obj: SceneObject, allObjects: Record<string, SceneObject>, depth: number = 0): string {
  const indent = "  ".repeat(depth);
  const styleStr = buildStyleString(obj.style);
  const styleAttr = styleStr ? ` style="${escapeHtml(styleStr)}"` : "";
  const children = obj.children.map((id) => {
    const child = allObjects[id];
    if (!child) return `<!-- missing child ${id} -->`;
    return renderObject(child, allObjects, depth + 1);
  }).join("\n");

  switch (obj.type) {
    case "screen":
      return `${indent}<div class="intent-screen" data-screen-id="${obj.id}"${styleAttr}>\n${children}\n${indent}</div>`;

    case "container":
      return `${indent}<div class="intent-container" data-object-id="${obj.id}"${styleAttr}>\n${children}\n${indent}</div>`;

    case "text": {
      const content = escapeHtml((obj.props.content as string) ?? "");
      return `${indent}<span class="intent-text" data-object-id="${obj.id}"${styleAttr}>${content}</span>`;
    }

    case "button": {
      const label = escapeHtml((obj.props.label as string) ?? "Button");
      const disabled = obj.props.disabled ? " disabled" : "";
      return `${indent}<button class="intent-button intent-button-${obj.props.variant}" data-object-id="${obj.id}"${styleAttr}${disabled}>${label}</button>`;
    }

    case "input": {
      const value = escapeHtml((obj.props.value as string) ?? "");
      const placeholder = escapeHtml((obj.props.placeholder as string) ?? "");
      const required = obj.props.required ? " required" : "";
      const disabled = obj.props.disabled ? " disabled" : "";
      return `${indent}<input class="intent-input" type="${obj.props.type}" value="${value}" placeholder="${placeholder}" data-object-id="${obj.id}"${styleAttr}${required}${disabled} />`;
    }

    case "image": {
      const src = escapeHtml((obj.props.src as string) ?? "");
      const alt = escapeHtml((obj.props.alt as string) ?? "");
      const fit = obj.props.fit;
      return `${indent}<img class="intent-image intent-fit-${fit}" src="${src}" alt="${alt}" data-object-id="${obj.id}"${styleAttr} />`;
    }

    default:
      return `${indent}<div class="intent-object" data-object-id="${obj.id}"${styleAttr}>\n${children}\n${indent}</div>`;
  }
}

function generateCssVariables(): string {
  return `
  :root {
    /* Colors */
    --intent-color-primary: #0066cc;
    --intent-color-primaryHover: #0052a3;
    --intent-color-secondary: #6c757d;
    --intent-color-background: #ffffff;
    --intent-color-surface: #f8f9fa;
    --intent-color-text-primary: #212529;
    --intent-color-text-secondary: #6c757d;
    --intent-color-border: #dee2e6;
    --intent-color-focus: #0066cc;
    --intent-color-error: #dc3545;
    --intent-color-success: #28a745;
    --intent-color-warning: #ffc107;

    /* Spacing */
    --intent-spacing-xs: 4px;
    --intent-spacing-sm: 8px;
    --intent-spacing-md: 16px;
    --intent-spacing-lg: 24px;
    --intent-spacing-xl: 32px;
    --intent-spacing-touchTarget: 44px;

    /* Typography */
    --intent-typography-fontFamily-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --intent-typography-fontFamily-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    --intent-typography-fontSize-xs: 12px;
    --intent-typography-fontSize-sm: 14px;
    --intent-typography-fontSize-md: 16px;
    --intent-typography-fontSize-lg: 20px;
    --intent-typography-fontSize-xl: 24px;
    --intent-typography-fontWeight-normal: 400;
    --intent-typography-fontWeight-medium: 500;
    --intent-typography-fontWeight-bold: 700;
    --intent-typography-lineHeight-tight: 1.25;
    --intent-typography-lineHeight-normal: 1.5;
    --intent-typography-lineHeight-relaxed: 1.75;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --intent-color-background: #1a1a2e;
      --intent-color-surface: #16213e;
      --intent-color-text-primary: #eaeaea;
      --intent-color-text-secondary: #a0a0a0;
      --intent-color-border: #2a2a4a;
    }
  }
`;
}

function generateBaseStyles(): string {
  return `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; font-family: var(--intent-typography-fontFamily-sans); font-size: var(--intent-typography-fontSize-md); line-height: var(--intent-typography-lineHeight-normal); color: var(--intent-color-text-primary); background: var(--intent-color-background); }

  .intent-screen { display: flex; flex-direction: column; min-height: 100%; }
  .intent-container { display: flex; }
  .intent-container[style*="direction: column"] { flex-direction: column; }
  .intent-container[style*="direction: row"] { flex-direction: row; }
  .intent-text { display: inline-block; }
  .intent-button { border: none; cursor: pointer; font-family: inherit; font-size: inherit; padding: var(--intent-spacing-sm) var(--intent-spacing-md); border-radius: 4px; min-width: var(--intent-spacing-touchTarget); min-height: var(--intent-spacing-touchTarget); }
  .intent-button:disabled { opacity: 0.5; cursor: not-allowed; }
  .intent-button-primary { background: var(--intent-color-primary); color: white; }
  .intent-button-primary:hover:not(:disabled) { background: var(--intent-color-primaryHover); }
  .intent-button-secondary { background: var(--intent-color-secondary); color: white; }
  .intent-button-outline { background: transparent; border: 2px solid var(--intent-color-primary); color: var(--intent-color-primary); }
  .intent-button-ghost { background: transparent; color: var(--intent-color-primary); }
  .intent-button-destructive { background: var(--intent-color-error); color: white; }
  .intent-input { font-family: inherit; font-size: inherit; padding: var(--intent-spacing-sm) var(--intent-spacing-md); border: 1px solid var(--intent-color-border); border-radius: 4px; background: var(--intent-color-background); color: var(--intent-color-text-primary); min-height: var(--intent-spacing-touchTarget); }
  .intent-input:focus { outline: 2px solid var(--intent-color-focus); outline-offset: 2px; }
  .intent-image { max-width: 100%; height: auto; display: block; }
  .intent-fit-cover { object-fit: cover; }
  .intent-fit-contain { object-fit: contain; }
  .intent-fit-fill { object-fit: fill; }
  .intent-fit-scale-down { object-fit: scale-down; }
  .intent-fit-none { object-fit: none; }

  /* Focus visible polyfill */
  :focus:not(:focus-visible) { outline: none; }
  :focus-visible { outline: 2px solid var(--intent-color-focus); outline-offset: 2px; }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  }
`;
}

const DEFAULT_HTML_OPTIONS: Required<HtmlExportOptions> = {
  includeStyles: true,
  includeScripts: true,
  inlineAssets: true,
  basePath: "/",
  cspNonce: "",
};

export function exportToHtml(scene: Scene, options: HtmlExportOptions = {}): string {
  const opts = { ...DEFAULT_HTML_OPTIONS, ...options };
  const validated = validateScene(scene);

  const screens = Object.values(validated.screens).sort((a, b) => {
    const idxA = validated.screenOrder.indexOf(a.id);
    const idxB = validated.screenOrder.indexOf(b.id);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });

  if (screens.length === 0) {
    screens.push(...Object.values(validated.screens));
  }

  const screenHtml = screens.map((screen) => {
    const allObjects = { ...validated.objects };
    return renderObject(screen, allObjects);
  }).join("\n\n");

  const cssVars = opts.includeStyles ? generateCssVariables() : "";
  const baseStyles = opts.includeStyles ? generateBaseStyles() : "";
  const cspAttr = opts.cspNonce ? ` nonce="${escapeHtml(opts.cspNonce)}"` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(validated.metadata.name ?? "Intent Export")}</title>
  ${cssVars ? `<style${cspAttr}>${cssVars}</style>` : ""}
  ${baseStyles ? `<style${cspAttr}>${baseStyles}</style>` : ""}
  ${opts.includeScripts ? `<script${cspAttr}>
    (function() {
      window.__INTENT_SCENE__ = ${JSON.stringify(validated)};
      window.__INTENT_VERSION__ = ${SCENE_SCHEMA_VERSION};
    })();
  </script>` : ""}
</head>
<body>
${screenHtml}
${opts.includeScripts ? `<script${cspAttr}>
  document.addEventListener("DOMContentLoaded", function() {
    document.querySelectorAll("[data-object-id]").forEach(function(el) {
      el.addEventListener("click", function(e) {
        window.postMessage({ type: "INTENT_CLICK", objectId: this.dataset.objectId }, "*");
      });
    });
  });
</script>` : ""}
</body>
</html>`;
}

export async function exportSceneToFile(scene: Scene, filePath: string, options: HtmlExportOptions = {}): Promise<void> {
  const html = exportToHtml(scene, options);
  const fs = await import("node:fs");
  const path = await import("node:path");
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, html, "utf-8");
}

export { SCHEMA_VERSION, SCENE_SCHEMA_VERSION };