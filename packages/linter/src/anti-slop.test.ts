import { describe, it, expect } from "vitest";
import type { SceneObject } from "@intent/schema";
import { lintSceneWithRules, ANTI_SLOP_RULES } from "./index.js";
import { antiSlopScene } from "./anti-slop-rules.js";

const IDS = [
  "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "o_01ARZ3NDEKTSV4RRFFQ69G5FAW",
  "o_01ARZ3NDEKTSV4RRFFQ69G5FAX",
  "o_01ARZ3NDEKTSV4RRFFQ69G5FAY",
];

function obj(index: number, overrides: Partial<SceneObject> = {}): SceneObject {
  return {
    id: IDS[index],
    type: "text",
    parentId: "s_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    children: [],
    props: { text: "Track household spending together" },
    style: {},
    meta: {},
    states: {},
    responsive: {},
    ...overrides,
  };
}

const RULE_IDS = ANTI_SLOP_RULES.map((r) => r.id);

function run(objects: SceneObject[], ruleIds = RULE_IDS) {
  return lintSceneWithRules(antiSlopScene(objects), ruleIds);
}

describe("anti-slop linter rules (final master order section C)", () => {
  it("reports no violations for a realistic, restrained scene", () => {
    const result = run([
      obj(0, { props: { text: "Track household spending together" }, style: { textAlign: "start" } }),
      obj(1, { props: { text: "See this month's shared budget" }, style: { textAlign: "start" } }),
      obj(2, { type: "button", props: { label: "Add expense" }, style: {} }),
    ]);
    expect(result.violations).toEqual([]);
    expect(result.pass).toBe(true);
  });

  const copyCases: { name: string; text: string }[] = [
    { name: "lorem ipsum", text: "Lorem ipsum dolor sit amet" },
    { name: "placeholder copy", text: "Your text here" },
    { name: "vague copy", text: "Unlock the power of better budgets" },
    { name: "generic name", text: "Hello, John Doe" },
    { name: "fake testimonial", text: "See our 5-star testimonial" },
    { name: "fake statistic", text: "100% guaranteed success" },
  ];
  for (const { name, text } of copyCases) {
    it(`fails on ${name}`, () => {
      const result = run([obj(0, { props: { text } })], ["L-SLOP-COPY"]);
      expect(result.violations.map((v) => v.ruleId)).toContain("L-SLOP-COPY");
      expect(result.violations[0]?.message).toContain("Banned");
    });
  }

  it("fails on emoji icons", () => {
    const result = run([obj(0, { props: { label: "Save 💾" } })], ["L-SLOP-EMOJI"]);
    expect(result.violations.map((v) => v.ruleId)).toEqual(["L-SLOP-EMOJI"]);
  });

  it("fails on a purple-blue gradient hero", () => {
    const result = run([obj(0, { style: { background: "linear-gradient(135deg, purple, blue)" } })], ["L-SLOP-GRADIENT"]);
    expect(result.violations.map((v) => v.ruleId)).toEqual(["L-SLOP-GRADIENT"]);
  });

  it("fails on three identical feature cards", () => {
    const cards = [0, 1, 2].map((i) =>
      obj(i, { type: "container", props: { title: "Fast, simple, secure" }, style: { padding: 16 } }),
    );
    const result = run(cards, ["L-SLOP-CARDS"]);
    expect(result.violations).toHaveLength(3);
    expect(result.violations.every((v) => v.ruleId === "L-SLOP-CARDS")).toBe(true);
  });

  it("fails when everything is centered", () => {
    const result = run([0, 1, 2].map((i) => obj(i, { style: { textAlign: "center" } })), ["L-SLOP-CENTERED"]);
    expect(result.violations).toHaveLength(3);
  });

  it("fails when shadow + rounded-xl is on most surfaces", () => {
    const result = run(
      [0, 1, 2].map((i) => obj(i, { type: "container", style: { boxShadow: "0 8px 24px rgba(0,0,0,.2)", borderRadius: 16 } })),
      ["L-SLOP-SHADOW"],
    );
    expect(result.violations).toHaveLength(3);
  });

  it("keeps all rule ids stable for callers", () => {
    expect(RULE_IDS).toEqual([
      "L-SLOP-COPY", "L-SLOP-EMOJI", "L-SLOP-GRADIENT", "L-SLOP-CARDS", "L-SLOP-CENTERED", "L-SLOP-SHADOW",
    ]);
  });
});
