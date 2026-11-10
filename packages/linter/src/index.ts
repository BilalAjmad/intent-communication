import { Scene, validateScene } from "@intent/schema";

export interface LintRule {
  id: string;
  name: string;
  severity: "error" | "warning" | "info";
  check: (scene: Scene, locks?: string[]) => LintViolation[];
}

export interface LintViolation {
  ruleId: string;
  objectId: string;
  message: string;
  severity: "error" | "warning" | "info";
  path: string;
  suggestion?: string;
}

export interface LintResult {
  violations: LintViolation[];
  pass: boolean;
}

const TOKEN_COLORS = {
  "token.color.primary": "#0066cc",
  "token.color.primaryHover": "#0052a3",
  "token.color.secondary": "#6c757d",
  "token.color.background": "#ffffff",
  "token.color.surface": "#f8f9fa",
  "token.color.text.primary": "#212529",
  "token.color.text.secondary": "#6c757d",
  "token.color.border": "#dee2e6",
  "token.color.focus": "#0066cc",
  "token.color.error": "#dc3545",
  "token.color.success": "#28a745",
  "token.color.warning": "#ffc107",
} as const;

type TokenColorKey = keyof typeof TOKEN_COLORS;

function getTokenColor(token: string): string {
  const colors = TOKEN_COLORS as Record<string, string>;
  return colors[token] ?? "";
}

function checkTokenUsage(obj: unknown, path: string, violations: unknown[]): void {
  const checkValue = (val: unknown, propPath: string): void => {
    if (typeof val === "object" && val !== null && (val as Record<string, unknown>).$type === "token") {
      const token = (val as Record<string, unknown>).$value as string;
      if (token && !token.startsWith("token.color.") && !token.startsWith("token.spacing.") && !token.startsWith("token.typography.")) {
        (violations as unknown[]).push({
          ruleId: "L-TOKEN-NAMESPACE",
          objectId: (val as Record<string, unknown>).id as string || "unknown",
          message: `Unknown token namespace in ${path}: ${val}. Use token.color.*, token.spacing.*, or token.typography.*`,
          severity: "error",
          path: propPath,
          suggestion: "Use tokens from the design system: token.color.*, token.spacing.*, token.typography.*",
        });
      }
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        checkValue(v, `${propPath}.${k}`);
      }
    } else if (Array.isArray(val)) {
      val.forEach((v, i) => checkValue(v, `${propPath}[${i}]`));
    }
  };

  for (const [key, val] of Object.entries((obj as Record<string, unknown>).props ?? {})) {
    checkValue(val, `props.${key}`);
  }
  for (const [key, val] of Object.entries(obj.style as Record<string, unknown>)) {
    checkValue(val, `style.${key}`);
  }
}

function checkColorUsage(obj: unknown, path: string, violations: unknown[]): void {
  const checkValue = (val: unknown, propPath: string): void => {
    if (typeof val === "string" && /^#[0-9a-fA-F]{3,8}$/.test(val)) {
      (violations as unknown[]).push({
        ruleId: "L-HARDCODED-COLOR",
        objectId: (val as any)?.id,
        message: `Hardcoded color in ${propPath}: ${val}. Use token.color.* instead`,
        severity: "error",
        path: propPath,
        suggestion: `Replace with token.color.primary, token.color.background, etc.`,
      });
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
        checkValue(v, `${propPath}.${key}`);
      }
    } else if (Array.isArray(val)) {
      val.forEach((v, i) => checkValue(v, `${propPath}[${i}]`));
    }
  };

  for (const [key, val] of Object.entries((obj as any).props ?? {})) {
    checkValue(val, `props.${key}`);
  }
  for (const [key, val] of Object.entries(obj.style as Record<string, unknown>)) {
    checkValue(val, `style.${key}`);
  }
}

function checkSpacingUsage(obj: unknown, path: string, violations: unknown[]): void {
  const checkValue = (val: unknown, propPath: string): void => {
    if (typeof val === "number" && propPath.match(/\.(gap|padding|margin|width|height|size)$/)) {
      if (!isTokenValue(val)) {
        violations.push({
          ruleId: "L-SPACING-TOKEN",
          objectId: (val as any)?.id ?? obj.id,
          message: `Raw spacing value in ${propPath}: ${val}. Use token.spacing.*`,
          severity: "warning",
          path: propPath,
          suggestion: `Use token.spacing.sm, token.spacing.md, token.spacing.lg, etc.`,
        });
      }
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
        checkValue(v, `${propPath}.${key}`);
      }
    } else if (Array.isArray(val)) {
      (val as unknown[]).forEach((v, i) => checkValue(v, `${propPath}[${i}]`));
    }
  };

  for (const [key, val] of Object.entries(obj.props ?? {})) {
    checkValue(val, `props.${key}`);
  }
  for (const [key, val] of Object.entries(obj.style as Record<string, unknown>)) {
    checkValue(val, `style.${key}`);
  }
}

function checkTypographyUsage(obj: unknown, path: string, violations: unknown[]): void {
  const checkValue = (val: unknown, propPath: string): void => {
    if (propPath.match(/\.(fontSize|fontFamily|fontWeight|lineHeight|letterSpacing)$/)) {
      if (!isTokenValue(val) && typeof val !== "number") {
        violations.push({
          ruleId: "L-TYPOGRAPHY-TOKEN",
          objectId: (val as any)?.id ?? obj.id,
          message: `Raw typography value in ${propPath}: ${val}. Use token.typography.*`,
          severity: "warning",
          path: propPath,
          suggestion: `Use token.typography.fontSize.md, token.typography.fontFamily.sans, etc.`,
        });
      }
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      for (const [key, v] of Object.entries(val as Record<string, unknown>)) {
        checkValue(v, `${propPath}.${key}`);
      }
    } else if (Array.isArray(val)) {
      (val as unknown[]).forEach((v, i) => checkValue(v, `${propPath}[${i}]`));
    }
  };

  for (const [key, val] of Object.entries(obj.props ?? {})) {
    checkValue(val, `props.${key}`);
  }
  for (const [key, val] of Object.entries(obj.style as Record<string, unknown>)) {
    checkValue(val, `style.${key}`);
  }
}

function checkContrast(obj: unknown, path: string, violations: unknown[]): void {
  if ((obj as any).type === "text") {
    const color = (obj as any).props.color as any;
    const background = (obj as any).style.background as any;
    if (color && background) {
      if (!isColorToken(color) || !isColorToken(background)) {
        (violations as unknown[]).push({
          ruleId: "L-CONTRAST-TOKENS",
          objectId: (obj as any).id,
          message: `Text color and background must both use color tokens for contrast verification`,
          severity: "warning",
          path: "props.color / style.background",
          suggestion: "Use token.color.text.primary on token.color.background.primary",
        });
      }
    }
  }
}

function checkInteractiveStates(obj: unknown, path: string, violations: unknown[]): void {
  if ((obj as any).type === "button" || (obj as any).type === "input") {
    const hasHover = "hover" in (obj as any).style || ":hover" in (obj as any).style;
    const hasFocus = "focus" in (obj as any).style || ":focus" in (obj as any).style;
    const hasDisabled = (obj as any).props.disabled === true || "disabled" in (obj as any).style || ":disabled" in (obj as any).style;

    if (!("hover" in (obj as any).style || ":hover" in (obj as any).style)) {
      (violations as unknown[]).push({
        ruleId: "L-HOVER-STATE",
        objectId: (obj as any).id,
        message: `Interactive element missing hover state`,
        severity: "warning",
        path: "style",
        suggestion: "Add hover style: style[':hover'] = { background: token.color.primaryHover }",
      });
    if (!("focus" in (obj as any).style || ":focus" in (obj as any).style)) {
      (violations as unknown[]).push({
        ruleId: "L-FOCUS-STATE",
        objectId: (obj as any).id,
        message: `Interactive element missing focus state`,
        severity: "error",
        path: "style",
        suggestion: "Add focus style: style[':focus-visible'] = { outline: '2px solid token.color.focus' }",
      });
    }
    if (!((obj as any).props.disabled === true || "disabled" in (obj as any).style || ":disabled" in (obj as any).style) && ((obj as any).type === "button" || (obj as any).type === "input")) {
      (violations as unknown[]).push({
        ruleId: "L-DISABLED-STATE",
        objectId: (obj as any).id,
        message: `Interactive element missing disabled state`,
        severity: "warning",
        path: "style",
        suggestion: "Add disabled style: style[':disabled'] = { opacity: 0.5, cursor: 'not-allowed' }",
      });
    }
  }
}

function checkTouchTarget(obj: unknown, path: string, violations: unknown[]): void {
  if ((obj as any).type === "button" || (obj as any).type === "input") {
    const width = (obj as any).style.width ?? (obj as any).style.minWidth;
    const height = (obj as any).style.height ?? (obj as any).style.minHeight;

    if (typeof (obj as any).style.width === "number" && (obj as any).style.width < 44) {
      (violations as unknown[]).push({
        ruleId: "L-TOUCH-WIDTH",
        objectId: (obj as Record<string, unknown>).id as string,
        message: `Touch target width ${width}px < 44px minimum`,
        severity: "error",
        path: "style.width",
        suggestion: "Set min-width: token.spacing.touchTarget (44px)",
      });
    }
    if (typeof (obj as any).style.height === "number" && (obj as any).style.height < 44) {
      (violations as unknown[]).push({
        ruleId: "L-TOUCH-HEIGHT",
        objectId: (obj as Record<string, unknown>).id as string,
        message: `Touch target height ${height}px < 44px minimum`,
        severity: "error",
        path: "style.height",
        suggestion: "Set min-height: token.spacing.touchTarget (44px)",
      });
    }
  }
}

function checkAltText(obj: unknown, path: string, violations: unknown[]): void {
  const objRecord = obj as Record<string, unknown>;
  if ((obj as any).type === "image") {
    const alt = (obj as any).props.alt as any;
    if (!alt || (typeof alt === "string" && alt.trim() === "")) {
      (violations as unknown[]).push({
        ruleId: "L-ALT-TEXT",
        objectId: (objRecord as Record<string, unknown>).id as string,
        message: `Image missing alt text`,
        severity: "error",
        path: "props.alt",
        suggestion: "Add descriptive alt text for accessibility",
      });
    }
  }
}

function checkContainerChildren(obj: unknown, path: string, violations: unknown[]): void {
  const objRecord = obj as Record<string, unknown>;
  if ((obj as any).type === "container") {
    if ((obj as any).children.length === 0) {
      (violations as unknown[]).push({
        ruleId: "L-EMPTY-CONTAINER",
        objectId: (objRecord as Record<string, unknown>).id as string,
        message: `Empty container - consider removing or adding children`,
        severity: "info",
        path: "children",
        suggestion: "Add child objects or remove empty container",
      });
    }
    const layout = (obj as any).props.layout as any;
    if (layout === "flex" && !(objRecord as Record<string, unknown>).props?.direction) {
      (violations as unknown[]).push({
        ruleId: "L-FLEX-DIRECTION",
        objectId: (objRecord as Record<string, unknown>).id as string,
        message: `Flex container missing direction`,
        severity: "warning",
        path: "props.direction",
        suggestion: "Set direction: 'row' or 'column'",
      });
}
}

function checkScreenTitle(obj: unknown, path: string, violations: unknown[]): void {
  const objRecord = obj as Record<string, unknown>;
  if ((obj as any).type === "screen") {
    const title = (obj as any).props.title as any;
    if (!title || (typeof title === "string" && title.trim() === "")) {
      (violations as unknown[]).push({
        ruleId: "L-SCREEN-TITLE",
        objectId: (objRecord as Record<string, unknown>).id as string,
        message: `Screen missing title`,
        severity: "warning",
        path: "props.title",
        suggestion: "Set a descriptive screen title",
      });
    }
  }
}

function checkDuplicateIds(objects: Record<string, unknown>, violations: unknown[]): void {
  const seen = new Set<string>();
  for (const [id, obj] of Object.entries(objects)) {
    if (seen.has(id)) {
      (violations as unknown[]).push({
        ruleId: "L-DUPLICATE-ID",
        objectId: id,
        message: `Duplicate object ID: ${id}`,
        severity: "error",
        path: "id",
        suggestion: "Ensure all object IDs are unique",
      });
    }
    seen.add(id);
  }
}

function checkOrphanedObjects(objects: Record<string, unknown>, violations: unknown[]): void {
  const referenced = new Set<string>();
  for (const obj of Object.values(objects)) {
    for (const childId of (obj as any).children) {
      referenced.add(childId);
    }
  }
  for (const [id, obj] of Object.entries(objects)) {
    const objRecord = obj as Record<string, unknown>;
    if (objRecord.parentId && !(objRecord.parentId in objects)) {
      (violations as unknown[]).push({
        ruleId: "L-INVALID-PARENT",
        objectId: id,
        message: `Object references non-existent parent: ${objRecord.parentId}`,
        severity: "error",
        path: "parentId",
        suggestion: "Fix parentId reference or create parent object",
      });
    }
    if ((obj as any).type !== "screen" && objRecord.parentId && !referenced.has(id)) {
      (violations as unknown[]).push({
        ruleId: "L-ORPHANED-OBJECT",
        objectId: id,
        message: `Object not referenced as child by its parent`,
        severity: "warning",
        path: "parentId",
        suggestion: "Add object ID to parent's children array",
      });
    }
  }
}

const M1_RULES = [
  { id: "L-SCHEMA", name: "Schema Validation", severity: "error" as const, check: (scene: any) => { const v: any[] = []; checkSchema(scene, v); return v; } },
  { id: "L-TOKEN-NAMESPACE", name: "Token Namespace", severity: "error" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkTokenUsage(obj, "", v); return v; } },
  { id: "L-HARDCODED-COLOR", name: "No Hardcoded Colors", severity: "error" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkColorUsage(obj, "", v); return v; } },
  { id: "L-SPACING-TOKEN", name: "Spacing Tokens", severity: "warning" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkSpacingUsage(obj, "", v); return v; } },
  { id: "L-TYPOGRAPHY-TOKEN", name: "Typography Tokens", severity: "warning" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkTypographyUsage(obj, "", v); return v; } },
  { id: "L-CONTRAST-TOKENS", name: "Contrast Tokens", severity: "warning" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkContrast(obj, "", v); return v; } },
  { id: "L-HOVER-STATE", name: "Hover State", severity: "warning" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkInteractiveStates(obj, "", v); return v; } },
  { id: "L-FOCUS-STATE", name: "Focus State", severity: "error" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkInteractiveStates(obj, "", v); return v; } },
  { id: "L-DISABLED-STATE", name: "Disabled State", severity: "warning" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkInteractiveStates(obj, "", v); return v; } },
  { id: "L-TOUCH-WIDTH", name: "Touch Target Width", severity: "error" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkTouchTarget(obj, "", v); return v; } },
  { id: "L-TOUCH-HEIGHT", name: "Touch Target Height", severity: "error" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkTouchTarget(obj, "", v); return v; } },
  { id: "L-ALT-TEXT", name: "Image Alt Text", severity: "error" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkAltText(obj, "", v); return v; } },
  { id: "L-EMPTY-CONTAINER", name: "Empty Container", severity: "info" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkContainerChildren(obj, "", v); return v; } },
  { id: "L-FLEX-DIRECTION", name: "Flex Direction", severity: "warning" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkContainerChildren(obj, "", v); return v; } },
  { id: "L-SCREEN-TITLE", name: "Screen Title", severity: "warning" as const, check: (scene: any) => { const v: any[] = []; for (const obj of Object.values(scene.objects)) checkScreenTitle(obj, "", v); return v; } },
  { id: "L-DUPLICATE-ID", name: "Duplicate IDs", severity: "error" as const, check: (scene: any) => { const v: any[] = []; checkDuplicateIds(scene.objects, v); return v; } },
  { id: "L-INVALID-PARENT", name: "Invalid Parent Ref", severity: "error" as const, check: (scene: any) => { const v: any[] = []; checkOrphanedObjects(scene.objects, v); return v; } },
  { id: "L-ORPHANED-OBJECT", name: "Orphaned Object", severity: "warning" as const, check: (scene: any) => { const v: any[] = []; checkOrphanedObjects(scene.objects, v); return v; } },
];

export function lintScene(scene: unknown): { violations: unknown[]; pass: boolean } {
  const validated = validateScene(scene as unknown);
  const violations: unknown[] = [];

  for (const rule of M1_RULES) {
    (violations as unknown[]).push(...rule.check(validated));
  }

  return {
    violations,
    pass: (violations as any[]).filter((v) => (v as any).severity === "error").length === 0,
  };
}

export function lintSceneWithRules(scene: unknown, ruleIds: string[]): { violations: unknown[]; pass: boolean } {
  const validated = validateScene(scene);
  const violations: unknown[] = [];

  for (const rule of M1_RULES) {
    if (ruleIds.includes(rule.id)) {
      (violations as unknown[]).push(...rule.check(validated));
    }
  }

  return {
    violations,
    pass: (violations as any[]).filter((v) => (v as any).severity === "error").length === 0,
  };
}

export { M1_RULES };
export type { LintRule, LintViolation, LintResult };