import { Scene, validateScene } from "@intent/schema";
import { M2_RULES } from "./m2-rules.js";
import { ANTI_SLOP_RULES } from "./anti-slop-rules.js";
import { hexToRgb } from "./color.js";

/**
 * Optional design-profile context for rules that need it (L-TOKEN, L-CONTRAST).
 * Mirrors .intent/design-profile.json as written by `intent scan` (trd 16).
 */
export interface LintProfile {
  tokens?: {
    colors?: Record<string, string>;
    spacing?: Record<string, string>;
    radii?: Record<string, string>;
  };
}

export interface LintRule {
  id: string;
  name: string;
  severity: "error" | "warning" | "info";
  check: (scene: Scene, locks?: string[], profile?: LintProfile) => LintViolation[];
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

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb;
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function isLargeText(obj: { props: Record<string, unknown> }): boolean {
  const props = obj.props ?? {};
  const fontSize = props["fontSize"] as number | undefined;
  const fontWeight = props["fontWeight"];
  const weightNum =
    typeof fontWeight === "number" ? fontWeight : fontWeight === "bold" ? 700 : fontWeight === "medium" ? 500 : 400;
  const size = typeof fontSize === "number" ? fontSize : 16;
  // WCAG 2.1 AA: large text = >= 24px regular, or >= 18.66px bold (~14pt bold)
  if (size >= 24) return true;
  if (size >= 18.66 && weightNum >= 700) return true;
  return false;
}

function tokenString(val: unknown): string | null {
  if (typeof val === "string") return val;
  if (
    typeof val === "object" &&
    val !== null &&
    (val as { $type?: unknown }).$type === "token" &&
    typeof (val as { $value?: unknown }).$value === "string"
  ) {
    return (val as { $value: string }).$value;
  }
  return null;
}

/** Merge the profile's hex color tokens over the built-in reference palette (profile wins). */
function buildColorMap(profile?: LintProfile): Record<string, string> {
  const map: Record<string, string> = { ...TOKEN_COLORS };
  const colors = profile?.tokens?.colors;
  if (!colors) return map;
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (hexToRgb(trimmed)) map[`token.color.${key}`] = trimmed;
  }
  return map;
}

/** Names of profile color tokens whose values are not valid hex strings (never merged into the color map). */
function invalidProfileTokens(profile?: LintProfile): string[] {
  const colors = profile?.tokens?.colors;
  if (!colors) return [];
  const bad: string[] = [];
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value !== "string" || !hexToRgb(value.trim())) bad.push(key);
  }
  return bad.sort();
}

function resolveColor(val: unknown, colorMap: Record<string, string>): [number, number, number] | null {
  const s = tokenString(val);
  if (!s) return null;
  if (s.startsWith("token.color.")) {
    const hex = colorMap[s];
    return hex ? hexToRgb(hex) : null;
  }
  return hexToRgb(s);
}

function checkSchema(scene: Scene, violations: LintViolation[]): void {
  const objectIds = new Set([...Object.keys(scene.objects), ...Object.keys(scene.screens)]);
  for (const [id, obj] of Object.entries(scene.objects)) {
    if (obj.type === "screen") {
      if (obj.parentId !== null) {
        violations.push({
          ruleId: "L-SCHEMA",
          objectId: id,
          message: `Screen must have null parentId`,
          severity: "error",
          path: "parentId",
          suggestion: "Set parentId to null for screens",
        });
      }
    } else {
      const parentId = obj.parentId;
      if (parentId && !objectIds.has(parentId)) {
        violations.push({
          ruleId: "L-SCHEMA",
          objectId: id,
          message: `Object references non-existent parent: ${parentId}`,
          severity: "error",
          path: "parentId",
          suggestion: "Fix parentId reference or create parent object",
        });
      }
    }
    for (const childId of obj.children) {
      if (!objectIds.has(childId)) {
        violations.push({
          ruleId: "L-SCHEMA",
          objectId: id,
          message: `Child references non-existent object: ${childId}`,
          severity: "error",
          path: "children",
          suggestion: "Fix children reference or create child object",
        });
      }
    }
  }
}

const GRID_KEYS = new Set(["margin", "padding", "gap", "width", "height", "size", "top", "left", "right", "bottom"]);

function checkGrid(scene: Scene, violations: LintViolation[]): void {
  const walkerObj = (id: string, val: unknown, path: string): void => {
    if (typeof val === "number") {
      const key = path.split(".").pop() ?? "";
      if (GRID_KEYS.has(key) && val % 4 !== 0) {
        violations.push({
          ruleId: "L-GRID",
          objectId: id,
          message: `Value ${val} at ${path} is not aligned to 4px grid`,
          severity: "error",
          path,
          suggestion: "Use a value divisible by 4",
        });
      }
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const rec = val as Record<string, unknown>;
      for (const [k, v] of Object.entries(rec)) {
        walkerObj(id, v, `${path}.${k}`);
      }
    } else if (Array.isArray(val)) {
      val.forEach((v, i) => walkerObj(id, v, `${path}[${i}]`));
    }
  };

  for (const [id, obj] of Object.entries(scene.objects)) {
    const style = obj.style ?? {};
    const props = obj.props ?? {};
    walkerObj(id, style, "style");
    walkerObj(id, props, "props");
  }
}

const SPACING_TOKENS: Record<string, number> = {
  "token.spacing.xs": 4,
  "token.spacing.sm": 8,
  "token.spacing.md": 16,
  "token.spacing.lg": 24,
  "token.spacing.xl": 32,
  "token.spacing.touchTarget": 44,
};

function numericLen(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  const s = tokenString(v);
  if (s && s in SPACING_TOKENS) return SPACING_TOKENS[s];
  return undefined;
}

function checkTouch(scene: Scene, violations: LintViolation[]): void {
  for (const [id, obj] of Object.entries(scene.objects)) {
    if (obj.type !== "button" && obj.type !== "input") continue;
    const style = obj.style ?? {};
    const width = numericLen(style["width"]) ?? numericLen(style["minWidth"]);
    const height = numericLen(style["height"]) ?? numericLen(style["minHeight"]);
    if (typeof width === "number" && width < 44) {
      violations.push({
        ruleId: "L-TOUCH",
        objectId: id,
        message: `Touch target width ${width}px < 44px minimum`,
        severity: "error",
        path: "style.width",
        suggestion: "Set min-width to 44px",
      });
    }
    if (typeof height === "number" && height < 44) {
      violations.push({
        ruleId: "L-TOUCH",
        objectId: id,
        message: `Touch target height ${height}px < 44px minimum`,
        severity: "error",
        path: "style.height",
        suggestion: "Set min-height to 44px",
      });
    }
  }
}

function checkContrast(scene: Scene, violations: LintViolation[], colorMap: Record<string, string>, profile?: LintProfile): void {
  const invalid = invalidProfileTokens(profile);
  for (const key of invalid) {
    violations.push({
      ruleId: "L-CONTRAST",
      objectId: "(profile)",
      message: `Design profile color token "${key}" is not a valid hex value — it was skipped`,
      severity: "warning",
      path: `tokens.colors.${key}`,
      suggestion: `Fix the value of "${key}" in .intent/design-profile.json to a #rrggbb hex`,
    });
  }
  for (const [id, obj] of Object.entries(scene.objects)) {
    if (obj.type !== "text") continue;
    const style = obj.style ?? {};
    const props = obj.props ?? {};
    // Text color may be authored in style (common) or props; background in style.
    const colorVal = style["color"] ?? props["color"];
    const bgVal = style["background"] ?? style["backgroundColor"] ?? props["background"];
    if (!colorVal || !bgVal) continue;
    const color = resolveColor(colorVal, colorMap);
    const bg = resolveColor(bgVal, colorMap);
    if (!color || !bg) {
      violations.push({
        ruleId: "L-CONTRAST",
        objectId: id,
        message: `Text color and background must both use color tokens for contrast verification`,
        severity: "warning",
        path: "props.color / style.background",
        suggestion: "Use token.color.text.primary on token.color.background",
      });
      continue;
    }
    const ratio = contrastRatio(color, bg);
    const large = isLargeText(obj);
    const threshold = large ? 3 : 4.5;
    if (ratio < threshold) {
      violations.push({
        ruleId: "L-CONTRAST",
        objectId: id,
        message: `Contrast ratio ${ratio.toFixed(2)}:1 is below ${threshold}:1 for ${large ? "large" : "normal"} text`,
        severity: "error",
        path: "props.color / style.background",
        suggestion: "Increase contrast between text and background",
      });
    }
  }
}

function checkLock(scene: Scene, locks: string[], violations: LintViolation[]): void {
  const lockSet = new Set(locks ?? []);
  for (const id of lockSet) {
    if (Object.prototype.hasOwnProperty.call(scene.objects, id)) {
      violations.push({
        ruleId: "L-LOCK",
        objectId: id,
        message: `Object is locked: ${id}`,
        severity: "error",
        path: "lock",
        suggestion: "Unlock object before editing",
      });
    }
  }
}

const M1_RULES: LintRule[] = [
  {
    id: "L-SCHEMA",
    name: "Schema Validation",
    severity: "error",
    check: (scene) => {
      const v: LintViolation[] = [];
      checkSchema(scene, v);
      return v;
    },
  },
  {
    id: "L-GRID",
    name: "4px Grid Alignment",
    severity: "error",
    check: (scene) => {
      const v: LintViolation[] = [];
      checkGrid(scene, v);
      return v;
    },
  },
  {
    id: "L-CONTRAST",
    name: "WCAG AA Contrast",
    severity: "warning",
    check: (scene, _locks, profile) => {
      const v: LintViolation[] = [];
      checkContrast(scene, v, buildColorMap(profile), profile);
      return v;
    },
  },
  {
    id: "L-TOUCH",
    name: "Touch Target 44px",
    severity: "error",
    check: (scene) => {
      const v: LintViolation[] = [];
      checkTouch(scene, v);
      return v;
    },
  },
  {
    id: "L-LOCK",
    name: "Lock Validation",
    severity: "error",
    check: (scene, locks) => {
      const v: LintViolation[] = [];
      checkLock(scene, locks ?? [], v);
      return v;
    },
  },
];

const ALL_RULES: LintRule[] = [...M1_RULES, ...M2_RULES, ...ANTI_SLOP_RULES];

function lintScene(scene: unknown, locks: string[] = [], profile?: LintProfile): LintResult {
  const validated = validateScene(scene);
  const violations: LintViolation[] = [];
  for (const rule of ALL_RULES) {
    violations.push(...rule.check(validated, locks, profile));
  }
  return {
    violations,
    pass: violations.filter((v) => v.severity === "error").length === 0,
  };
}

function lintSceneWithRules(scene: unknown, ruleIds: string[], locks: string[] = [], profile?: LintProfile): LintResult {
  const known = new Set(ALL_RULES.map((r) => r.id));
  const unknown = ruleIds.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(`Unknown lint rule id(s): ${unknown.join(", ")}. Known ids: ${[...known].join(", ")}`);
  }
  const validated = validateScene(scene);
  const violations: LintViolation[] = [];
  for (const rule of ALL_RULES) {
    if (ruleIds.includes(rule.id)) {
      violations.push(...rule.check(validated, locks, profile));
    }
  }
  return {
    violations,
    pass: violations.filter((v) => v.severity === "error").length === 0,
  };
}

export { M1_RULES, M2_RULES, ANTI_SLOP_RULES, ALL_RULES, lintScene, lintSceneWithRules };
