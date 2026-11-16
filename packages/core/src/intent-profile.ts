import { randomBytes } from "node:crypto";
import type { IntentProfile, IntentProfileEntry } from "@intent/schema";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function newProfileEntryId(): string {
  const bytes = randomBytes(26);
  let out = "q_";
  for (let i = 0; i < 26; i++) out += CROCKFORD[(bytes[i] as number) % 32];
  return out;
}

/**
 * trd 17.1 — the Intent Profile: learned, normalized preferences.
 *
 * Signal detection is keyword-based and conservative: one weak signal only
 * accumulates evidence; an entry only becomes active after 2 consistent
 * signals or 1 explicit statement ("always", "never", "I prefer"). Free text
 * is never stored verbatim — entries keep a small normalized phrase. Keys come
 * from INTENT_PROFILE_KEYS; unknown keys are dropped by the schema.
 *
 * Determinism: merge is order-stable; ids use randomUUID on creation only.
 */

export interface PreferenceSignal {
  key: (typeof INTENT_PROFILE_KEYS)[number] | string;
  value: string;
  text: string;
  explicit: boolean;
  ref: string | null;
}

const INTENT_PROFILE_KEYS: readonly string[] = [
  "style.density",
  "style.corner",
  "style.palette",
  "style.motion",
  "style.contrast",
  "content.tone",
  "content.language",
  "layout.navigation",
  "layout.layout",
  "dislikes",
];

const EXPLICIT = /\b(always|never|i prefer|i want|i like|i hate|i don't like|my favorite|don't ever|from now on|as a rule)\b/i;

interface KeywordClass {
  key: string;
  value: string;
  text: string;
  patterns: RegExp[];
}

const KEYWORD_CLASSES: KeywordClass[] = [
  { key: "style.density", value: "compact", text: "prefers a compact density", patterns: [/\bcompact\b/i, /\bdense(ly)?\b/i, /\btight\b/i] },
  { key: "style.density", value: "spacious", text: "prefers a spacious density", patterns: [/\bspacious\b/i, /\broomy\b/i, /\bairy\b/i, /\bloose\b/i] },
  { key: "style.density", value: "comfortable", text: "prefers a comfortable density", patterns: [/\bcomfortable\b/i] },
  { key: "style.corner", value: "rounded", text: "prefers rounded corners", patterns: [/\brounded\b/i, /\bround corners\b/i] },
  { key: "style.corner", value: "sharp", text: "prefers sharp corners", patterns: [/\bsharp corners\b/i, /\bsquare corners\b/i, /\bno radius\b/i] },
  { key: "style.corner", value: "pill", text: "prefers pill-shaped components", patterns: [/\bpill\b/i] },
  { key: "style.palette", value: "dark", text: "prefers a dark palette", patterns: [/\bdark (mode|theme|palette)\b/i] },
  { key: "style.palette", value: "light", text: "prefers a light palette", patterns: [/\blight (mode|theme|palette)\b/i] },
  { key: "style.palette", value: "system", text: "prefers the system palette", patterns: [/\bsystem (palette|theme)\b/i, /\bauto (palette|theme)\b/i, /\bmatch(es)? the system\b/i] },
  { key: "style.motion", value: "reduced", text: "prefers reduced motion", patterns: [/\b(no|less|reduced|minimal) (motion|animations?)\b/i, /\breduce motion\b/i] },
  { key: "style.motion", value: "full", text: "prefers full motion", patterns: [/\b(full|rich|plenty of) (motion|animations?)\b/i, /\banimations? (are )?(fine|ok|great)\b/i] },
  { key: "style.contrast", value: "high", text: "prefers high contrast", patterns: [/\bhigh contrast\b/i, /\bbigger contrast\b/i] },
  { key: "content.tone", value: "playful", text: "prefers a playful tone", patterns: [/\bplayful\b/i, /\bfun\b/i] },
  { key: "content.tone", value: "professional", text: "prefers a professional tone", patterns: [/\bprofessional\b/i, /\bformal\b/i, /\bserious\b/i] },
  { key: "content.tone", value: "concise", text: "prefers a concise tone", patterns: [/\bconcise\b/i, /\bterse\b/i, /\bshort (copy|text|messages)\b/i, /\bminimal (copy|text)\b/i] },
  { key: "content.tone", value: "friendly", text: "prefers a friendly tone", patterns: [/\bfriendly\b/i, /\bwarm\b/i] },
  { key: "layout.navigation", value: "sidebar", text: "prefers a sidebar navigation", patterns: [/\bsidebar\b/i] },
  { key: "layout.navigation", value: "top", text: "prefers top navigation", patterns: [/\btop (nav(igation)?|bar|navigation)\b/i] },
  { key: "layout.navigation", value: "bottom", text: "prefers bottom navigation", patterns: [/\bbottom (nav(igation)?|tabs|bar)\b/i, /\btab bar\b/i] },
  { key: "layout.navigation", value: "wizard", text: "prefers a wizard/step-by-step flow", patterns: [/\bwizard\b/i, /\bstep[- ]by[- ]step\b/i, /\bstepper\b/i] },
];

const DISLIKE = /\b(?:never|no more|i hate|i don't like|i dislike|don't ever)\s+([a-z0-9][a-z0-9 -]{2,60})/i;

/** Extracts normalized, closed-key signals from one text. `ref` is the supporting answer questionId. */
export function detectSignals(text: string, ref: string | null): PreferenceSignal[] {
  if (typeof text !== "string" || text.trim().length === 0) return [];
  const trimmed = text.slice(0, 2000);
  const explicit = EXPLICIT.test(trimmed);
  const signals: PreferenceSignal[] = [];
  for (const cls of KEYWORD_CLASSES) {
    if (cls.patterns.some((pattern) => pattern.test(trimmed))) {
      signals.push({ key: cls.key, value: cls.value, text: cls.text, explicit, ref });
    }
  }
  const dislike = DISLIKE.exec(trimmed);
  if (dislike?.[1]) {
    const normalized = dislike[1].trim().replace(/\s+/g, " ").slice(0, 60);
    if (normalized) {
      signals.push({ key: "dislikes", value: normalized, text: `dislikes ${normalized}`, explicit: true, ref });
    }
  }
  return signals;
}

/**
 * Merges signals into the profile. Entry identity is (key, value).
 * Pure: the input profile is never mutated — every touched entry is copied.
 * - Existing entry: count += 1; confidence = min(0.5 + 0.25 * count, 0.95); explicit raises to >= 0.9.
 * - New entry: count = 1; confidence = explicit ? 0.9 : 0.5.
 * - Conflicting value under the same key: an explicit signal replaces it; a weak signal cannot.
 */
export function mergeSignals(profile: IntentProfile, signals: PreferenceSignal[], now: string): IntentProfile {
  // Deep-copy entries (including the nested source object) so callers can
  // safely compare, diff or discard the result without polluting the input.
  const entries = profile.entries.map((e) => ({ ...e, source: { ...e.source, refs: [...e.source.refs] } }));
  for (const signal of signals) {
    const existing = entries.find((e) => e.key === signal.key && e.value === signal.value);
    if (existing) {
      const count = existing.count + 1;
      existing.count = count;
      existing.confidence = Math.max(Math.min(0.5 + 0.25 * count, 0.95), signal.explicit ? 0.9 : 0);
      if (signal.explicit) existing.confidence = Math.max(existing.confidence, 0.9);
      if (signal.ref && !existing.source.refs.includes(signal.ref)) {
        existing.source.refs = [...existing.source.refs, signal.ref].slice(-20);
      }
      existing.updatedAt = now;
      continue;
    }

    const conflicting = entries.find((e) => e.key === signal.key && e.value !== signal.value);
    if (conflicting && !signal.explicit) {
      continue; // weak signal cannot displace an existing value for the same key
    }
    if (conflicting && signal.explicit) {
      // Explicit statement wins; the replaced entry's confidence drops so it leaves the active set.
      const idx = entries.indexOf(conflicting);
      entries[idx] = {
        ...conflicting,
        confidence: Math.min(conflicting.confidence, 0.3),
        updatedAt: now,
      };
    }

    entries.push({
      id: newProfileEntryId(),
      key: (INTENT_PROFILE_KEYS.includes(signal.key) ? signal.key : "dislikes") as IntentProfileEntry["key"],
      value: signal.value,
      text: signal.text.slice(0, 200),
      source: { kind: "answer", refs: signal.ref ? [signal.ref] : [] },
      count: 1,
      confidence: signal.explicit ? 0.9 : 0.5,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Cap total entries; drop the weakest (confidence, then count) beyond 100.
  entries.sort((a, b) => b.confidence - a.confidence || b.count - a.count);
  return {
    schemaVersion: 1,
    entries: entries.slice(0, 100),
  };
}

const CONFIDENCE_ACTIVE = 0.8;

/** Human-readable one-liner of ACTIVE entries only. Never scene text; at most ~200 chars. */
export function summarizeProfile(profile: IntentProfile): string {
  const active = profile.entries.filter((e) => e.confidence >= CONFIDENCE_ACTIVE);
  if (active.length === 0) return "";
  const parts = active.map((e) => e.text);
  const summary = `user profile — ${parts.join("; ")}`;
  return summary.length > 200 ? `${summary.slice(0, 197)}…` : summary;
}

/** Keys the profile already holds with confidence >= 0.8 — used for ask_user preFilled. */
export function preFilledForTopic(profile: IntentProfile, topic: string | undefined): Record<string, unknown> | undefined {
  if (!topic) return undefined;
  const keyFor: Record<string, string> = {
    content: "content.tone",
    style: "style.palette",
    behavior: "style.motion",
    screens: "layout.layout",
    layout: "layout.navigation",
  };
  const key = keyFor[topic];
  if (!key) return undefined;
  const active = profile.entries.filter((e) => e.confidence >= CONFIDENCE_ACTIVE);
  const hit = active.find((e) => e.key === key);
  return hit ? { key: hit.key, value: hit.value, text: hit.text, remembered: true } : undefined;
}

/** Best-effort text out of an interview answer (string, or { text|label|value|summaryChoice|answer }). */
export function answerText(answer: unknown): string {
  if (typeof answer === "string") return answer;
  if (!answer || typeof answer !== "object") return "";
  const rec = answer as Record<string, unknown>;
  for (const field of ["text", "label", "value", "summaryChoice", "answer", "choice"]) {
    const v = rec[field];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

interface IntentProfileStorage {
  readIntentProfile(): Promise<IntentProfile>;
  writeIntentProfile(profile: IntentProfile): Promise<void>;
}

/**
 * Records whatever an answer teaches us. Best effort: never throws, returns
 * true when the profile changed. Called by both the MCP ask_user path and the
 * Studio /api/interview/answer path so learning works no matter who asked.
 */
export async function recordAnswerLearning(
  storage: IntentProfileStorage,
  answer: unknown,
  ref: string | null,
  now: string,
): Promise<boolean> {
  const text = answerText(answer);
  const signals = detectSignals(text, ref);
  if (signals.length === 0) return false;
  try {
    const profile = await storage.readIntentProfile();
    const merged = mergeSignals(profile, signals, now);
    await storage.writeIntentProfile(merged);
    return true;
  } catch {
    return false;
  }
}
