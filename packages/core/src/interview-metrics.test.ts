import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createStoragePort } from "./storage-port.js";
import { recordInterviewMetrics, summarizeInterviewMetrics } from "./interview-metrics";
import type { InterviewMetrics } from "@intent/schema";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";

// TC-MET-04 — Interview efficiency report, computed from a hand-built fixture
// metrics.json. Pure derivation: no storage, no network.
describe("interview efficiency report (TC-MET-04)", () => {
  const fixture: InterviewMetrics = {
    schemaVersion: 1,
    sessions: [
      { sessionKey: "2026-11-10T10:00:00.000Z", asked: 3, answered: 4, delegated: 1, skipped: 0, harvested: 0, prefilledShown: 2, serverCaps: 1, summaryChoices: ["exactly-right"], finalPercent: 92, abandoned: false },
      { sessionKey: "2026-11-11T10:00:00.000Z", asked: 5, answered: 6, delegated: 0, skipped: 1, harvested: 0, prefilledShown: 1, serverCaps: 0, summaryChoices: ["change", "exactly-right"], finalPercent: 95, abandoned: false },
      { sessionKey: "2026-11-12T10:00:00.000Z", asked: 2, answered: 3, delegated: 2, skipped: 0, harvested: 0, prefilledShown: 3, serverCaps: 0, summaryChoices: [], finalPercent: null, abandoned: true },
      { sessionKey: "2026-11-13T10:00:00.000Z", asked: 4, answered: 5, delegated: 0, skipped: 0, harvested: 0, prefilledShown: 0, serverCaps: 1, summaryChoices: ["ask-more"], finalPercent: null, abandoned: false },
    ],
  };

  const report = summarizeInterviewMetrics(fixture);

  it("keeps the asked-per-session series and computes the average", () => {
    expect(report.sessions).toBe(4);
    expect(report.askedPerSession).toEqual([3, 5, 2, 4]);
    expect(report.avgAsked).toBe(3.5);
  });

  it("computes the delegation rate over collected sessions", () => {
    // Σ delegated = 1+0+2+0 = 3; Σ answered = 4+6+3+5 = 18 → 1/6
    expect(report.delegateRate).toBeCloseTo(3 / 18, 10);
  });

  it("reports prefill acceptance as null when nothing was collected (never faked)", () => {
    expect(report.prefillAcceptance).toBeNull();
  });

  it("computes the first-summary approval share over decided sessions", () => {
    // Decided: s1 (exactly-right), s2 (change), s4 (ask-more) → 1/3
    expect(report.firstSummaryApprovalShare).toBeCloseTo(1 / 3, 10);
  });
});

// Recorder: drive a small synthetic interview against a real (tmp) storage
// port and inspect the metrics file afterwards.
describe("recordInterviewMetrics (write path)", () => {
  let dir: string;
  let storage: ReturnType<typeof createStoragePort>;

  beforeEach(async () => {
    dir = resolve(os.tmpdir(), `.test-interview-metrics-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(dir, { recursive: true });
    storage = createStoragePort(dir);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  const readSessions = async () => (await storage.readInterviewMetrics()).sessions;

  it("opens a session on kind:start and closes nothing yet", async () => {
    await recordInterviewMetrics(storage, { kind: "start", questionNumber: 1, currentQuestionIndex: 0, meterAfter: 4, capped: false, preFilledShown: false, now: "2026-11-18T10:00:00.000Z" });
    const sessions = await readSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ asked: 1, answered: 0, abandoned: false, finalPercent: null });
  });

  it("counts answers and opt-in delegated markers", async () => {
    await recordInterviewMetrics(storage, { kind: "start", questionNumber: 1, currentQuestionIndex: 0, meterAfter: 4, capped: false, preFilledShown: true, now: "2026-11-18T10:00:00.000Z" });
    await recordInterviewMetrics(storage, { kind: "choice", questionNumber: 2, currentQuestionIndex: 1, meterAfter: 12, capped: false, preFilledShown: false, recordedAnswer: { answer: { body: "Dark", delegated: true }, questionKind: "start" } });
    const sessions = await readSessions();
    expect(sessions[0]).toMatchObject({ asked: 2, answered: 1, delegated: 1, prefilledShown: 1 });
  });

  it("closes the session with finalPercent on a summary exactly-right answer", async () => {
    await recordInterviewMetrics(storage, { kind: "start", questionNumber: 1, currentQuestionIndex: 0, meterAfter: 4, capped: false, preFilledShown: false, now: "2026-11-18T10:00:00.000Z" });
    await recordInterviewMetrics(storage, { kind: "summary", questionNumber: 2, currentQuestionIndex: 1, meterAfter: 91, capped: false, preFilledShown: false, recordedAnswer: { answer: { summaryChoice: "exactly-right" }, questionKind: "summary" } });
    const sessions = await readSessions();
    expect(sessions[0]).toMatchObject({ answered: 1, summaryChoices: ["exactly-right"], finalPercent: 91 });
  });

  it("marks the previous open session abandoned when a new interview starts", async () => {
    await recordInterviewMetrics(storage, { kind: "start", questionNumber: 1, currentQuestionIndex: 0, meterAfter: 4, capped: false, preFilledShown: false, now: "2026-11-18T10:00:00.000Z" });
    await recordInterviewMetrics(storage, { kind: "start", questionNumber: 1, currentQuestionIndex: 0, meterAfter: 4, capped: false, preFilledShown: false, now: "2026-11-18T11:00:00.000Z" });
    const sessions = await readSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({ abandoned: true });
    expect(sessions[1]).toMatchObject({ abandoned: false, sessionKey: "2026-11-18T11:00:00.000Z" });
  });

  it("keeps only the last 50 sessions", async () => {
    for (let i = 0; i < 55; i += 1) {
      await recordInterviewMetrics(storage, { kind: "start", questionNumber: 1, currentQuestionIndex: 0, meterAfter: 4, capped: false, preFilledShown: false, now: `2026-11-18T10:${String(i).padStart(2, "0")}:00.000Z` });
    }
    const sessions = await readSessions();
    expect(sessions).toHaveLength(50);
  });

  it("never throws when the metrics store is broken (best effort)", async () => {
    await fs.mkdir(resolve(dir, ".intent"), { recursive: true });
    await fs.writeFile(resolve(dir, ".intent", "metrics.json"), "{ not json", "utf-8");
    await expect(
      recordInterviewMetrics(storage, { kind: "start", questionNumber: 1, currentQuestionIndex: 0, meterAfter: 4, capped: false, preFilledShown: false }),
    ).resolves.toBeUndefined();
  });
});
