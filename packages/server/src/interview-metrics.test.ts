import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./index";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

// TC-MET-04 — the interview efficiency report endpoint: computed on demand
// from `.intent/metrics.json`, nothing leaves the machine.
const testDir = tmpdir() + "/.test-interview-metrics-api";

let server: ReturnType<typeof createServer>;
let port = 0;

const url = (path: string) => `http://127.0.0.1:${port}${path}`;
const origin = () => ({ Origin: `http://127.0.0.1:${port}` });

const METRICS = {
  schemaVersion: 1,
  sessions: [
    { sessionKey: "2026-11-10T10:00:00.000Z", asked: 3, answered: 4, delegated: 1, skipped: 0, prefilledShown: 2, serverCaps: 1, summaryChoices: ["exactly-right"], finalPercent: 92, abandoned: false },
    { sessionKey: "2026-11-11T10:00:00.000Z", asked: 5, answered: 6, delegated: 0, skipped: 1, prefilledShown: 1, serverCaps: 0, summaryChoices: ["change", "exactly-right"], finalPercent: 95, abandoned: false },
    { sessionKey: "2026-11-12T10:00:00.000Z", asked: 2, answered: 3, delegated: 2, skipped: 0, prefilledShown: 3, serverCaps: 0, summaryChoices: [], finalPercent: null, abandoned: true },
  ],
};

async function seed(): Promise<void> {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(testDir, ".intent", "interview"), { recursive: true });
  await fs.writeFile(resolve(testDir, ".intent", "metrics.json"), JSON.stringify(METRICS), "utf-8");
  server = createServer({
    projectRoot: testDir,
    previewPort: 0,
    studioPort: 3461,
    mcpPort: 3462,
  });
  port = await server.start();
}

async function exchange(): Promise<string> {
  const token = server.getSessionToken();
  const response = await fetch(url("/api/session"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...origin() },
    body: JSON.stringify({ token }),
  });
  expect(response.status).toBe(204);
  const setCookie = response.headers.get("Set-Cookie") ?? "";
  const sessionId = (setCookie.match(/intent_session=([^;]+)/) || [])[1] ?? "";
  return `intent_session=${sessionId}`;
}

beforeEach(seed);
afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

describe("Interview metrics API", () => {
  it("GET /api/interview-metrics returns the derived report", async () => {
    const cookie = await exchange();
    const res = await fetch(url("/api/interview-metrics"), { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; report: { sessions: number; avgAsked: number | null; delegateRate: number | null; firstSummaryApprovalShare: number | null } };
    expect(body.ok).toBe(true);
    expect(body.report.sessions).toBe(3);
    expect(body.report.avgAsked).toBeCloseTo(10 / 3, 10);
    expect(body.report.delegateRate).toBeCloseTo(3 / 13, 10);
    expect(body.report.firstSummaryApprovalShare).toBeCloseTo(0.5, 10);
  });

  it("GET /api/interview-metrics returns the empty report when metrics.json is missing", async () => {
    await fs.rm(resolve(testDir, ".intent", "metrics.json"), { force: true });
    const cookie = await exchange();
    const res = await fetch(url("/api/interview-metrics"), { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { report: { sessions: number; avgAsked: number | null } };
    expect(body.report.sessions).toBe(0);
    expect(body.report.avgAsked).toBeNull();
  });
});
