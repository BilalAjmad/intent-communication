import { Scene, SceneObject, validateScene } from "@intent/schema";

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

const GRID_UNIT = 4;
const MIN_TOUCH_TARGET = 44;

const TOKEN_COLORS: Record<string, string> = {
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
};

function tokenToHex(token: string): string | null {
  return TOKEN_COLORS[token] ?? null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

function toSrgb(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(r: number, g: number, b: number): number {
  const rLin = toSrgb(r);
  const gLin = toSrgb(g);
  const bLin = toSrgb(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function contrastRatio(fg: string, bg: string): number | null {
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);
  if (!fgRgb || !bgRgb) return null;
  const L1 = luminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const L2 = luminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function isLargeText(fontSize: number): boolean {
  return fontSize >= 18;
}

function getTokenColorHex(value: any): string | null {
  if (typeof value === "object" && value !== null && "$type" in value && value.$type === "token") {
    return tokenToHex(value.$value as string);
  }
  return null;
}

function isTokenValue(value: any): boolean {
  return typeof value === "object" && value !== null && "$type" in value && value.$type === "token";
}

function getTokenString(value: any): string | null {
  if (isTokenValue(value)) {
    return value.$value as string;
  }
  return null;
}

function isColorToken(value: any): boolean {
  const token = getTokenString(value);
  return token ? /^token\.color\./.test(token) : false;
}

function checkSchema(scene: Scene, violations: LintViolation[]): void {
  for (const [id, obj] of Object.entries(scene.objects)) {
    if (!obj.id || obj.id !== id) {
      violations.push({
        ruleId: "L-SCHEMA",
        objectId: id,
        message: `Object ID mismatch: key "${id}" != object.id "${obj.id}"`,
        severity: "error",
        path: "id",
        suggestion: "Ensure object key matches object.id",
      });
    }
    if (!obj.type) {
      violations.push({
        ruleId: "L-SCHEMA",
        objectId: id,
        message: `Object missing required 'type' field`,
        severity: "error",
        path: "type",
        suggestion: "Add type: 'screen' | 'container' | 'text' | 'button' | 'input' | 'image'",
      });
    }
    if (obj.type === "screen" && obj.parentId !== null) {
      violations.push({
        ruleId: "L-SCHEMA",
        objectId: id,
        message: `Screen must have parentId: null`,
        severity: "error",
        path: "parentId",
        suggestion: "Set parentId to null for screens",
      });
    }
    if (obj.type !== "screen" && !obj.parentId) {
      violations.push({
        ruleId: "L-SCHEMA",
        objectId: id,
        message: `Non-screen object missing parentId`,
        severity: "error",
        path: "parentId",
        suggestion: "Set parentId to parent object ID",
      });
    }
    if (obj.parentId && !scene.objects[obj.parentId]) {
      violations.push({
        ruleId: "L-SCHEMA",
        objectId: id,
        message: `Object references non-existent parent: ${obj.parentId}`,
        severity: "error",
        path: "parentId",
        suggestion: "Fix parentId reference or create parent object",
      });
    }
  }
}

function checkGrid(scene: Scene, violations: LintViolation[]): void {
  for (const [id, obj] of Object.entries(scene.objects)) {
    const checkValue = (val: any, path: string): void => {
      if (typeof val === "number" && path.startsWith("style.")) {
        if (val % GRID_UNIT !== 0) {
          violations.push({
            ruleId: "L-GRID",
            objectId: id,
            message: `Style value ${val} at ${path} not aligned to ${GRID_UNIT}px grid`,
            severity: "error",
            path,
            suggestion: `Use multiples of ${GRID_UNIT}px (token.spacing.*)`,
          });
        }
      } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        for (const [k, v] of Object.entries(val)) {
          checkValue(v, `${path}.${k}`);
        }
      } else if (Array.isArray(val)) {
        val.forEach((v, i) => checkValue(v, `${path}[${i}]`));
      }
    };

    for (const [key, val] of Object.entries(obj.style)) {
      checkValue(val, `style.${key}`);
    }
  }
}

function checkContrast(scene: Scene, violations: LintViolation[]): void {
  for (const [id, obj] of Object.entries(scene.objects)) {
    if (obj.type === "text") {
      const color = obj.props.color;
      const background = obj.style["background"];
      const fontSize = (obj.props.fontSize ?? 16) as number;

      if (color && background) {
        const fgHex = getTokenColorHex(color) ?? (typeof color === "string" && color.startsWith("#") ? color : null);
        const bgHex = getTokenColorHex(background) ?? (typeof background === "string" && background.startsWith("#") ? background : null);

        if (fgHex && bgHex) {
          const ratio = contrastRatio(fgHex, bgHex);
          const minRatio = isLargeText(fontSize) ? 3 : 4.5;
          if (ratio !== null && ratio < minRatio) {
            violations.push({
              ruleId: "L-CONTRAST",
              objectId: id,
              message: `Contrast ratio ${ratio.toFixed(2)}:1 below WCAG AA ${minRatio}:1 (fg: ${fgHex}, bg: ${bgHex}, fontSize: ${fontSize})`,
              severity: "error",
              path: "props.color / style.background",
              suggestion: `Use token.color.text.primary on token.color.background (ratio 12.6:1)`,
            });
          }
        } else {
          violations.push({
            ruleId: "L-CONTRAST",
            objectId: id,
            message: `Text color and background must both use color tokens or valid hex for contrast verification`,
            severity: "error",
            path: "props.color / style.background",
            suggestion: "Use token.color.text.primary on token.color.background",
          });
        }
      }
    }
  }
}

function checkTouch(scene: Scene, violations: LintViolation[]): void {
  for (const [id, obj] of Object.entries(scene.objects)) {
    if (obj.type === "button" || obj.type === "input") {
      const width = obj.style["width"] ?? obj.style["minWidth"];
      const height = obj.style["height"] ?? obj.style["minHeight"];
      if (typeof width === "number" && width < MIN_TOUCH_TARGET) {
        violations.push({
          ruleId: "L-TOUCH",
          objectId: id,
          message: `Touch target width ${width}px < ${MIN_TOUCH_TARGET}px minimum`,
          severity: "error",
          path: "style.width",
          suggestion: `Set min-width: ${MIN_TOUCH_TARGET}px (token.spacing.touchTarget)`,
        });
      }
      if (typeof height === "number" && height < MIN_TOUCH_TARGET) {
        violations.push({
          ruleId: "L-TOUCH",
          objectId: id,
          message: `Touch target height ${height}px < ${MIN_TOUCH_TARGET}px minimum`,
          severity: "error",
          path: "style.height",
          suggestion: `Set min-height: ${MIN_TOUCH_TARGET}px (token.spacing.touchTarget)`,
        });
      }
    }
  }
}

function checkLock(scene: Scene, violations: LintViolation[], lockedObjects: string[] = []): void {
  // Check if any object in scene is locked (by ID in locks.json)
  for (const [id, obj] of Object.entries(scene.objects)) {
    if (lockedObjects.includes(id)) {
      violations.push({
        ruleId: "L-LOCK",
        objectId: id,
        message: `Object ${id} is locked`,
        severity: "error",
        path: "id",
        suggestion: "Release lock before editing",
      });
    }
  }
}

const M1_RULES: LintRule[] = [
  { id: "L-SCHEMA", name: "Schema Validation", severity: "error", check: (scene) => { const v: LintViolation[] = []; checkSchema(scene, v); return v; } },
  { id: "L-GRID", name: "4px Grid Alignment", severity: "error", check: (scene) => { const v: LintViolation[] = []; checkGrid(scene, v); return v; } },
  { id: "L-CONTRAST", name: "Contrast Tokens", severity: "error", check: (scene) => { const v: LintViolation[] = []; checkContrast(scene, v); return v; } },
  { id: "L-TOUCH", name: "Touch Target 44px", severity: "error", check: (scene) => { const v: LintViolation[] = []; checkTouch(scene, v); return v; } },
  { id: "L-LOCK", name: "Lock Validation", severity: "error", check: (scene, locks) => { const v: LintViolation[] = []; checkLock(scene, v, locks); return v; } },
];

export function lintScene(scene: Scene, locks: string[] = []): LintResult {
  const validated = validateScene(scene);
  const violations: LintViolation[] = [];

  for (const rule of M1_RULES) {
    if (rule.id === "L-LOCK") {
      violations.push(...rule.check(validated, locks));
    } else {
      violations.push(...rule.check(validated));
    }
  }

  return {
    violations,
    pass: violations.filter((v) => v.severity === "error").length === 0,
  };
}

export function lintSceneWithRules(scene: Scene, ruleIds: string[], locks: string[] = []): LintResult {
  const validated = validateScene(scene);
  const violations: LintViolation[] = [];

  for (const rule of M1_RULES) {
    if (ruleIds.includes(rule.id)) {
      if (rule.id === "L-LOCK") {
        violations.push(...rule.check(validated, locks));
      } else {
        violations.push(...rule.check(validated));
      }
    }
  }

  return {
    violations,
    pass: violations.filter((v) => v.severity === "error").length === 0,
  };
}

export { M1_RULES };