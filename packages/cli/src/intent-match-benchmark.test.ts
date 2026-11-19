import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import type { Scene } from "@intent/schema";
import { createMCPContext, handleMCPRequest } from "@intent/mcp-server";
import { exportToHtml } from "@intent/engine";

/**
 * Synthetic intent-match benchmark (honest framing — see docs/benchmark.md).
 *
 * What this measures: the interview -> build -> lint -> export pipeline holds
 * its own invariants when a scripted persona drives it. Every requirement is
 * machine-checkable. It is NOT a human acceptance-rate measurement and cannot
 * produce or validate the 97% target (P8, docs/acceptance-protocol.md).
 *
 * What this does NOT measure: whether a real user would say the result matches
 * their intent. Only the human trial can tell that.
 *
 * Each task: seed a minimal scene, run 8 ask_user rounds + a summary
 * (exactly-right), apply build patches reflecting the persona's answers,
 * then score 6 machine-checkable requirements.
 */

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const HERO = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BODY = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const CTA = "o_03ARZ3NDEKTSV4RRFFQ69G5FAV";
const PHONE = "o_04ARZ3NDEKTSV4RRFFQ69G5FAV";

const TOPICS = ["goal", "users", "screens", "flow", "style", "content", "behavior", "edge"] as const;

function seedScene(): Scene {
  return {
    version: 1,
    revision: 0,
    createdAt: "2026-11-18T00:00:00.000Z",
    updatedAt: "2026-11-18T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [HERO, BODY, CTA, PHONE],
        props: { title: "Untitled", width: 392, height: 844 }, style: {}, meta: {},
      },
    },
    objects: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [HERO, BODY, CTA, PHONE],
        props: { title: "Untitled", width: 392, height: 844 }, style: {}, meta: {},
      },
      [HERO]: {
        id: HERO, type: "text", parentId: SCREEN, children: [],
        props: { content: "placeholder", fontSize: 32, fontWeight: "bold" },
        style: {}, meta: {},
      },
      [BODY]: {
        id: BODY, type: "text", parentId: SCREEN, children: [],
        props: { content: "placeholder", fontSize: 16 },
        style: {}, meta: {},
      },
      [CTA]: {
        id: CTA, type: "button", parentId: SCREEN, children: [],
        props: { label: "placeholder", variant: "primary", disabled: false, size: "lg" },
        style: {}, meta: {},
        states: { loading: { style: { opacity: 0.6 } } },
      },
      [PHONE]: {
        id: PHONE, type: "input", parentId: SCREEN, children: [],
        props: { placeholder: "placeholder", value: "", type: "tel", disabled: false, required: true },
        style: {}, meta: {},
        states: { filled: { style: {} }, error: { style: {} } },
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Benchmark Seed", tags: [] },
  } as Scene;
}

const patch = (objectId: string, path: string, value: unknown, baseRevision: number) => ({
  id: "p_01ARZ3NDEKTSV4RRFFQ69G5FAV",
  sceneId: SCREEN,
  baseRevision,
  objectId,
  op: "set" as const,
  path,
  value,
  createdAt: "2026-11-18T00:00:00.000Z",
  status: "sent" as const,
  appliedAt: null,
  conflictWith: null,
});

const ask = (input: Record<string, unknown>, context: ReturnType<typeof createMCPContext>) =>
  handleMCPRequest("ask_user", input, context) as Promise<Record<string, unknown>>;

interface BenchTask {
  name: string;
  persona: Record<(typeof TOPICS)[number], string>;
  summary: string;
  build: { objectId: string; path: string; value: unknown }[];
  htmlRequirement: { label: string; test: (html: string) => boolean };
}

const TASKS: BenchTask[] = [
  {
    name: "Task A — salon booking app",
    persona: {
      goal: "salon booking app for walk-ins and regulars; services: haircut, color, beard, nails",
      users: "salon owners and their walk-in clients, 25-45, mobile-first",
      screens: "one screen is enough: hero + services + book button + phone input",
      flow: "client opens, reads hero, picks a service from the list, enters phone, taps Book now",
      style: "warm, friendly, clean; no dark mode; feels like a boutique salon",
      content: "copy must name services with prices; call to action must say Book now",
      behavior: "Book now button is primary; phone input accepts any text",
      edge: "no business hours shown; no auth; no payment — phone number is all we collect",
    },
    summary: "A salon booking app for one screen, services with prices, phone input, Book now button.",
    build: [
      { objectId: SCREEN, path: "props.title", value: "Salon Booking" },
      { objectId: HERO, path: "props.content", value: "Book your next salon appointment in seconds — haircuts, color, beard, nails." },
      { objectId: BODY, path: "props.content", value: "Haircut $45 · Color $85 · Beard Trim $20 · Manicure $30" },
      { objectId: CTA, path: "props.label", value: "Book now" },
      { objectId: PHONE, path: "props.placeholder", value: "Your phone number" },
    ],
    htmlRequirement: { label: "export names the salon", test: (html) => /salon/i.test(html) },
  },
  {
    name: "Task B — SaaS pricing page",
    persona: {
      goal: "pricing page for a SaaS project tracker; three plans; monthly and yearly billing",
      users: "indie developers and small studios evaluating the tracker",
      screens: "hero, three plan cards, email capture, FAQ accordion — one page",
      flow: "visitor reads hero, scans plans and prices, enters work email, taps Start free",
      style: "confident SaaS look; lots of whitespace; no illustrations",
      content: "three plans named Starter, Pro, Team with monthly prices; claim must say Start free",
      behavior: "Start free button is primary; email input required",
      edge: "no free trial wording; no discounts; no testimonials",
    },
    summary: "A one-page SaaS pricing layout: Starter/Pro/Team with prices, work-email capture, Start free button.",
    build: [
      { objectId: SCREEN, path: "props.title", value: "Pricing — Project Tracker" },
      { objectId: HERO, path: "props.content", value: "Simple, honest pricing — keep your projects calm and moving." },
      { objectId: BODY, path: "props.content", value: "Starter $0 · Pro $12 · Team $29 · Yearly billing saves 20%" },
      { objectId: CTA, path: "props.label", value: "Start free" },
      { objectId: PHONE, path: "props.placeholder", value: "Work email" },
    ],
    htmlRequirement: { label: "export shows Pro plan price", test: (html) => html.includes("$12") },
  },
];

let testDir: string;
let context: ReturnType<typeof createMCPContext>;

beforeEach(async () => {
  testDir = resolve(os.tmpdir(), `.test-intent-benchmark-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(testDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(testDir, ".intent", "scenes", `${SCREEN}.json`), JSON.stringify(seedScene()), "utf-8");
  context = createMCPContext(testDir);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

describe("Synthetic intent-match benchmark (2 tasks, 6 requirements each)", () => {
  for (const task of TASKS) {
    // Heavyweight integration benchmark: full interview → pipeline → build → verify,
    // multiple seconds per task even on fast machines — 5s default is not enough on loaded runners.
    it(task.name, async () => {
      // 1) Interview: 8 rounds, persona answers deterministically, then summary exactly-right.
      for (const topic of TOPICS) {
        await ask({
          kind: "start", questionId: `q-${topic}`, prompt: `Tell me about ${topic}`, topic,
          options: [{ value: "answer", label: "Answer" }],
          questionNumber: TOPICS.indexOf(topic) + 1, estimatedTotal: TOPICS.length + 1,
          meter: { percent: 25 + TOPICS.indexOf(topic) * 10, topics: { [topic]: "covered" } },
          previousAnswer: TOPICS.indexOf(topic) > 0
            ? { questionId: `q-${TOPICS[TOPICS.indexOf(topic) - 1]}`, answer: { topic, text: task.persona[topic] } }
            : undefined,
        }, context);
      }
      await ask({
        kind: "summary", questionId: "summary", prompt: "Here is what I understood. Exactly right?", questionNumber: 9,
        summary: { paragraph: task.summary, items: [{ topic: "goal", text: task.persona.goal.slice(0, 80) }], delegated: [] },
        meter: { percent: 95, topics: Object.fromEntries(TOPICS.map((t) => [t, "covered"])) },
        previousAnswer: { questionId: "q-edge", answer: { topic: "edge", text: task.persona.edge } },
      }, context);
      await ask({
        kind: "confirm", questionId: "done", prompt: "Understood — building now.",
        previousAnswer: { questionId: "summary", answer: { summaryChoice: "exactly-right" } },
      }, context);

      const stateRaw = await fs.readFile(resolve(testDir, ".intent", "interview", "state.json"), "utf-8");
      const state = JSON.parse(stateRaw) as { status: string; answers: unknown[] };

      // 2) Build: patches reflect the persona's answers.
      let revision = 0;
      const apply = async (objectId: string, path: string, value: unknown) => {
        const result = (await handleMCPRequest("apply_patch", {
          patch: patch(objectId, path, value, revision),
        }, context)) as { success: boolean; revision?: number; error?: string };
        expect(result.success, `patch ${path} failed: ${result.error}`).toBe(true);
        if (typeof result.revision === "number") revision = result.revision;
      };
      for (const p of task.build) await apply(p.objectId, p.path, p.value);

      const scene = JSON.parse(await fs.readFile(resolve(testDir, ".intent", "scenes", `${SCREEN}.json`), "utf-8")) as Scene;
      // Lint through the real MCP validate tool (it runs the full M1+M2 ruleset).
      const validated = (await handleMCPRequest("validate", { type: "scene", data: scene }, context)) as {
        valid: boolean;
        lint?: { pass?: boolean | null; violations?: { severity: string }[] };
      };
      const lintErrors = validated.lint?.violations?.filter((v) => v.severity === "error") ?? [];

      const html = exportToHtml(scene, { includeDataIds: true });

      // 3) Score: 6 machine-checkable requirements.
      const checks = [
        { label: "interview completed (status=complete)", pass: state.status === "complete" },
        { label: "export contains CSP meta", pass: html.includes("Content-Security-Policy") },
        { label: task.htmlRequirement.label, pass: task.htmlRequirement.test(html) },
        { label: "export includes primary CTA label", pass: html.includes(String(task.build.find((p) => p.objectId === CTA)?.value ?? "")) },
        { label: "export includes hero copy", pass: html.includes(String(task.build.find((p) => p.objectId === HERO)?.value ?? "no").slice(0, 20)) },
        { label: "zero error-severity lint violations (via MCP validate)", pass: lintErrors.length === 0 },
      ];
      const report = checks.map((c) => `  ${c.pass ? "PASS" : "FAIL"}  ${c.label}`).join("\n");
      console.log(`\n[benchmark] ${task.name}\n${report}`);
      for (const c of checks) expect(c.pass, c.label).toBe(true);
    }, 60000);
  }
});
