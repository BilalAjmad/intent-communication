import type { Scene, SceneObject } from "@intent/schema";
import type { LintRule, LintViolation } from "./index.js";

/**
 * Anti-slop rules (final master order 2026-11-21, section C).
 *
 * These check only what can be checked mechanically. They reduce generic
 * AI-looking output but CANNOT guarantee taste; a human review is still
 * required. Things with no reliable signal in the scene model (one primary
 * action per screen, heading levels, dark/light theme completeness) stay in
 * design-principles.md as human-review items.
 */

const TEXT_KEYS = new Set([
  "label", "text", "content", "title", "placeholder", "ariaLabel", "alt", "description", "heading", "body", "value",
]);

const BANNED_COPY: { re: RegExp; label: string }[] = [
  { re: /\blorem ipsum\b/i, label: "lorem ipsum" },
  { re: /\bplaceholder (text|copy|here)?\b/i, label: "placeholder copy" },
  { re: /\b(welcome to|unlock the power of|seamless|revolutionary|game[- ]changer|cutting[- ]edge)\b/i, label: "vague marketing copy" },
  { re: /\b(john doe|jane doe|acme|foo bar|test user)\b/i, label: "generic name" },
  { re: /\b(dummy text|sample text|coming soon|tbd|your text here)\b/i, label: "placeholder copy" },
  { re: /\b(testimonial|5[- ]star review)\b/i, label: "fake testimonial" },
  { re: /\b(100%|99\.9%|10x|5x)[^.]{0,40}\b(guaranteed|success|faster|better)\b/i, label: "fake statistic" },
];

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
// Split from EMOJI: combining FS in the same class trips no-misleading-character-class.
const VARIATION_SELECTOR = /\u{FE0F}/u;

function texts(obj: SceneObject): { value: string; path: string }[] {
  const out: { value: string; path: string }[] = [];
  for (const [key, val] of Object.entries(obj.props ?? {})) {
    if (TEXT_KEYS.has(key) && typeof val === "string") out.push({ value: val, path: `props.${key}` });
  }
  for (const [stateName, override] of Object.entries(obj.states ?? {})) {
    if (typeof override?.text === "string") out.push({ value: override.text, path: `states.${stateName}.text` });
    if (override?.props && typeof override.props === "object") {
      for (const [key, val] of Object.entries(override.props)) {
        if (TEXT_KEYS.has(key) && typeof val === "string") out.push({ value: val, path: `states.${stateName}.props.${key}` });
      }
    }
  }
  return out;
}

function styleStrings(obj: SceneObject): string {
  return JSON.stringify(obj.style ?? {});
}

function violation(id: string, obj: SceneObject, ruleId: string, message: string): LintViolation {
  return { ruleId, objectId: obj.id, message, severity: "error", path: `objects.${obj.id}.${id}` };
}

const copyRule: LintRule = {
  id: "L-SLOP-COPY",
  name: "Anti-slop: realistic content",
  severity: "error",
  check: (scene) => {
    const violations: LintViolation[] = [];
    for (const obj of Object.values(scene.objects)) {
      for (const { value, path } of texts(obj)) {
        for (const { re, label } of BANNED_COPY) {
          if (re.test(value)) violations.push(violation(path, obj, copyRule.id, `Banned ${label}: "${value.slice(0, 80)}"`));
        }
      }
    }
    return violations;
  },
};

const emojiRule: LintRule = {
  id: "L-SLOP-EMOJI",
  name: "Anti-slop: no emoji icons",
  severity: "error",
  check: (scene) => {
    const violations: LintViolation[] = [];
    for (const obj of Object.values(scene.objects)) {
      for (const { value, path } of texts(obj)) {
        if (EMOJI.test(value) || VARIATION_SELECTOR.test(value)) violations.push(violation(path, obj, emojiRule.id, `Emoji used as icon/content: "${value.slice(0, 80)}"`));
      }
    }
    return violations;
  },
};

const gradientRule: LintRule = {
  id: "L-SLOP-GRADIENT",
  name: "Anti-slop: no purple-blue gradient hero",
  severity: "error",
  check: (scene) => {
    const violations: LintViolation[] = [];
    for (const obj of Object.values(scene.objects)) {
      const style = styleStrings(obj);
      if (/gradient/i.test(style) && /(purple|violet|indigo|#8b5cf6|#6366f1|#4f46e5|#a855f7|\bblue\b|#0066cc)/i.test(style)) {
        violations.push(violation("style", obj, gradientRule.id, "Purple/blue gradient is a banned AI trope"));
      }
    }
    return violations;
  },
};

const CARDS = new Set(["card", "container", "panel"]);

const cardsRule: LintRule = {
  id: "L-SLOP-CARDS",
  name: "Anti-slop: no three identical feature cards",
  severity: "error",
  check: (scene) => {
    const violations: LintViolation[] = [];
    const groups = new Map<string, SceneObject[]>();
    for (const obj of Object.values(scene.objects)) {
      if (!CARDS.has(obj.type)) continue;
      const signature = JSON.stringify([obj.parentId, obj.type, obj.props, obj.style]);
      const group = groups.get(signature) ?? [];
      group.push(obj);
      groups.set(signature, group);
    }
    for (const group of groups.values()) {
      if (group.length < 3) continue;
      for (const obj of group) {
        violations.push(violation("shape", obj, cardsRule.id, "Three identical sibling cards — vary the content or the layout"));
      }
    }
    return violations;
  },
};

const centeredRule: LintRule = {
  id: "L-SLOP-CENTERED",
  name: "Anti-slop: not everything centered",
  severity: "error",
  check: (scene) => {
    const objects = Object.values(scene.objects);
    if (objects.length < 3) return [];
    const centered = objects.filter((obj) => {
      const s = obj.style as Record<string, unknown>;
      return s["textAlign"] === "center" || (s["align"] === "center" && s["justify"] === "center");
    });
    if (centered.length < objects.length) return [];
    return centered.map((obj) => violation("style", obj, centeredRule.id, "Every object is centered — use an asymmetric layout"));
  },
};

const shadowRule: LintRule = {
  id: "L-SLOP-SHADOW",
  name: "Anti-slop: no shadow + rounded-xl everywhere",
  severity: "error",
  check: (scene) => {
    const objects = Object.values(scene.objects);
    if (objects.length < 3) return [];
    const styled = objects.filter((obj) => {
      const s = obj.style as Record<string, unknown>;
      const shadow = s["boxShadow"] ?? s["shadow"];
      const radius = s["borderRadius"];
      const big = (typeof radius === "number" && radius >= 12) || (typeof radius === "string" && parseFloat(radius) >= 12);
      return shadow !== undefined && shadow !== "none" && big;
    });
    if (styled.length < 3 || styled.length / objects.length < 0.6) return [];
    return styled.map((obj) => violation("style", obj, shadowRule.id, "Shadow + large radius on most surfaces — use borders and restraint"));
  },
};

export const ANTI_SLOP_RULES: LintRule[] = [copyRule, emojiRule, gradientRule, cardsRule, centeredRule, shadowRule];

/** Helper for tests: a minimal scene with one screen holding the given objects. */
export function antiSlopScene(objects: SceneObject[]): Scene {
  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-21T00:00:00.000Z",
    updatedAt: "2026-11-21T00:00:00.000Z",
    screens: {
      "s_01ARZ3NDEKTSV4RRFFQ69G5FAV": {
        id: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV", type: "screen", parentId: null,
        children: objects.map((o) => o.id),
        props: { title: "Test", width: 1280, height: 720 }, style: {}, meta: {}, states: {}, responsive: {},
      },
    },
    objects: Object.fromEntries(objects.map((o) => [o.id, o])),
    screenOrder: ["s_01ARZ3NDEKTSV4RRFFQ69G5FAV"],
    metadata: { name: "Test", tags: [] },
  } as unknown as Scene;
}
