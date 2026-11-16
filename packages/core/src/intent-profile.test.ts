import { describe, it, expect } from "vitest";
import { detectSignals, mergeSignals, summarizeProfile, preFilledForTopic, answerText } from "./intent-profile.js";
import type { IntentProfile } from "@intent/schema";

const empty = (): IntentProfile => ({ schemaVersion: 1, entries: [] });
const NOW = "2026-11-16T00:00:00.000Z";

describe("detectSignals (trd 17.1)", () => {
  it("extracts weak signals from plain preferences", () => {
    const signals = detectSignals("make it compact please", "q-1");
    expect(signals).toContainEqual(
      expect.objectContaining({ key: "style.density", value: "compact", explicit: false, ref: "q-1" }),
    );
  });

  it("marks explicit statements with always/never/i prefer", () => {
    const signals = detectSignals("I always want compact density", "q-2");
    expect(signals.every((s) => s.explicit)).toBe(true);
  });

  it("captures dislikes with the trailing phrase, stored normalized", () => {
    const signals = detectSignals("i don't like purple gradients", "q-3");
    const dislike = signals.find((s) => s.key === "dislikes");
    expect(dislike?.value).toBe("purple gradients");
    expect(dislike?.explicit).toBe(true);
  });

  it("ignores empty text and never throws on junk", () => {
    expect(detectSignals("", null)).toEqual([]);
    expect(detectSignals("zzz qqq xxx", null)).toEqual([]);
  });
});

describe("mergeSignals (trd 17.1 activation rules)", () => {
  it("weak signals need 2 consistent occurrences to become active", () => {
    let profile = empty();
    profile = mergeSignals(profile, detectSignals("compact please", "a"), NOW);
    expect(summarizeProfile(profile)).toBe(""); // 0.5 confidence — not active
    profile = mergeSignals(profile, detectSignals("very compact", "b"), NOW);
    const entry = profile.entries.find((e) => e.key === "style.density");
    expect(entry?.count).toBe(2);
    expect(entry?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(summarizeProfile(profile)).toContain("compact");
  });

  it("explicit statements activate immediately", () => {
    const profile = mergeSignals(empty(), detectSignals("I always want a dark mode", "a"), NOW);
    const entry = profile.entries.find((e) => e.key === "style.palette");
    expect(entry?.confidence).toBe(0.9);
    expect(summarizeProfile(profile)).toContain("dark");
  });

  it("a weak signal cannot displace an existing value for the same key", () => {
    let profile = mergeSignals(empty(), detectSignals("I prefer a dark mode", "a"), NOW); // explicit dark
    profile = mergeSignals(profile, detectSignals("a light palette", "b"), NOW); // weak light
    const density = profile.entries.filter((e) => e.key === "style.palette");
    expect(density.map((e) => e.value)).toEqual(["dark"]);
  });

  it("an explicit signal displaces a weak existing value", () => {
    let profile = mergeSignals(empty(), detectSignals("a light palette", "a"), NOW); // weak light
    profile = mergeSignals(profile, detectSignals("actually, I want a dark palette", "b"), NOW); // explicit dark
    const entries = profile.entries.filter((e) => e.key === "style.palette");
    expect(entries.find((e) => e.value === "dark")?.confidence).toBe(0.9);
    expect(entries.find((e) => e.value === "light")?.confidence).toBeLessThanOrEqual(0.3);
  });

  it("does not mutate its input profile", () => {
    const before = empty();
    const snapshot = JSON.stringify(before);
    mergeSignals(before, detectSignals("compact please", "a"), NOW);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("prefilled only surfaces active entries with the mapped topic", () => {
    let profile = empty();
    profile = mergeSignals(profile, detectSignals("I always want playful tone", "a"), NOW);
    expect(preFilledForTopic(profile, "content")).toMatchObject({ key: "content.tone", remembered: true });
    expect(preFilledForTopic(profile, "style")).toBeUndefined();
  });

  it("never stores scene text: entries carry normalized values only", () => {
    const secret = "The quarterly report object o_01ABCDEFG is confidential";
    const profile = mergeSignals(empty(), detectSignals(secret, "a"), NOW);
    expect(JSON.stringify(profile)).not.toContain("confidential");
  });
});

describe("answerText", () => {
  it("extracts text from plain strings and common shapes", () => {
    expect(answerText("compact")).toBe("compact");
    expect(answerText({ text: "compact" })).toBe("compact");
    expect(answerText({ value: "compact" })).toBe("compact");
    expect(answerText({ summaryChoice: "exactly-right" })).toBe("exactly-right");
    expect(answerText(42)).toBe("");
    expect(answerText(null)).toBe("");
  });
});
