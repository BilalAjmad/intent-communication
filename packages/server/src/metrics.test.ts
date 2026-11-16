import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./index";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

// trd 17.2: acceptance-rate metric. Baseline = earliest first-render snapshot;
// patches applied after it (from the feedback queue) count as agent changes.
const testDir = tmpdir() + "/.test-metrics-api";
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BASELINE_FILE = "2026-11-16T00-00-00-000Z-r1-first-render.json";

let server: ReturnType<typeof createServer>;
let port = 0;

const url = (path: string) => `http://127.0.0.1:${port}${path}`;
const origin = () => ({ Origin: `http://127.0.0.1:${port}` });

function makeScene(name: string, revision: number, extraObjects: Record<string, unknown> = {}) {
  return {
    version: 1,
    revision,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [OBJECT],
        props: { title: "Home", width: 1280, height: 720 },
        style: {}, meta: {},
      },
    },
    objects: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [OBJECT],
        props: { title: "Home", width: 1280, height: 720 },
        style: {}, meta: {},
      },
      [OBJECT]: {
        id: OBJECT, type: "text", parentId: SCREEN, children: [],
        props: { content: "Hello" }, style: {}, meta: {},
      },
      ...extraObjects,
    },
    screenOrder: [SCREEN],
    metadata: { name, tags: [] },
  };
}

function makeFeedback(overrides: Record<string, unknown>) {
  return {
    id: "o_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    sceneId: "default",
    objectId: OBJECT,
    kind: "visual",
    message: "Test feedback",
    severity: "medium",
    status: "applied",
    createdAt: "2026-11-16T00:00:01.000Z",
    appliedAt: "2026-11-16T01:00:00.000Z",
    patchId: null,
    ...overrides,
  };
}

async function seed(options: { baseline?: string | null; feedback?: unknown[] } = {}): Promise<void> {
  const { baseline = BASELINE_FILE, feedback } = options;
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(testDir, ".intent", "scenes"), { recursive: true });
  await fs.mkdir(resolve(testDir, ".intent", "versions"), { recursive: true });
  await fs.mkdir(resolve(testDir, ".intent", "feedback"), { recursive: true });
  const current = makeScene("Metrics Test", 3, {
    // one object added after baseline
    o_03ARZ3NDEKTSV4RRFFQ69G5FAV: {
      id: "o_03ARZ3NDEKTSV4RRFFQ69G5FAV", type: "button", parentId: SCREEN, children: [],
      props: { label: "New" }, style: {}, meta: {},
    },
  });
  await fs.writeFile(resolve(testDir, ".intent", "scenes", "default.json"), JSON.stringify(current), "utf-8");
  if (baseline) {
    await fs.writeFile(resolve(testDir, ".intent", "versions", baseline), JSON.stringify(makeScene("Baseline", 1)), "utf-8");
  }
  if (feedback) {
    await fs.writeFile(resolve(testDir, ".intent", "feedback", "default.json"), JSON.stringify(feedback), "utf-8");
  }
  server = createServer({
    projectRoot: testDir,
    previewPort: 0,
    studioPort: 3457,
    mcpPort: 3458,
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

beforeEach(() => seed());
afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

describe("Metrics API (trd 17.2)", () => {
  it("reports available:false with a reason when there is no first-render baseline", async () => {
    await fs.rm(resolve(testDir, ".intent", "versions", BASELINE_FILE), { force: true });
    const cookie = await exchange();
    const response = await fetch(url("/api/metrics?sceneId=default"), { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { baseline: unknown; metrics: { available: boolean; reason?: string } };
    expect(body.baseline).toBeNull();
    expect(body.metrics.available).toBe(false);
    expect(body.metrics.reason).toContain("no baseline");
  });

  it("reports 0% acceptance when the only baseline object was applied after the baseline", async () => {
    await fs.writeFile(
      resolve(testDir, ".intent", "feedback", "default.json"),
      JSON.stringify([makeFeedback({})]),
      "utf-8",
    );
    const cookie = await exchange();
    const response = await fetch(url("/api/metrics?sceneId=default"), { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      baseline: { file: string; revision: number };
      metrics: { available: boolean; acceptanceRate: number | null; unchanged: number; addedAfterBaseline: number; removedAfterBaseline: number };
    };
    expect(body.baseline?.file).toBe(BASELINE_FILE);
    expect(body.metrics.available).toBe(true);
    expect(body.metrics.unchanged).toBe(0);
    expect(body.metrics.acceptanceRate).toBe(0);
    expect(body.metrics.addedAfterBaseline).toBe(1);
    expect(body.metrics.removedAfterBaseline).toBe(0);
  });

  it("excludes applied patches from before the baseline from the changed set", async () => {
    await fs.writeFile(
      resolve(testDir, ".intent", "feedback", "default.json"),
      JSON.stringify([makeFeedback({ appliedAt: "2026-11-15T00:00:00.000Z" })]),
      "utf-8",
    );
    const cookie = await exchange();
    const response = await fetch(url("/api/metrics?sceneId=default"), { headers: { Cookie: cookie } });
    const body = (await response.json()) as { metrics: { acceptanceRate: number | null; unchanged: number } };
    expect(body.metrics.unchanged).toBe(1);
    expect(body.metrics.acceptanceRate).toBe(1);
  });

  it("excludes applied patches without a parseable appliedAt", async () => {
    await fs.writeFile(
      resolve(testDir, ".intent", "feedback", "default.json"),
      JSON.stringify([makeFeedback({ appliedAt: null })]),
      "utf-8",
    );
    const cookie = await exchange();
    const response = await fetch(url("/api/metrics?sceneId=default"), { headers: { Cookie: cookie } });
    const body = (await response.json()) as { metrics: { acceptanceRate: number | null; unchanged: number } };
    expect(body.metrics.unchanged).toBe(1);
    expect(body.metrics.acceptanceRate).toBe(1);
  });

  it("treats a corrupt baseline snapshot as unavailable rather than fabricating one", async () => {
    await fs.writeFile(resolve(testDir, ".intent", "versions", BASELINE_FILE), "not json {{{", "utf-8");
    const cookie = await exchange();
    const response = await fetch(url("/api/metrics?sceneId=default"), { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { baseline: unknown; metrics: { available: boolean; reason?: string } };
    expect(body.baseline).toBeNull();
    expect(body.metrics.available).toBe(false);
  });

  it("requires a session (403) and rejects a bad sceneId (400)", async () => {
    const unauth = await fetch(url("/api/metrics?sceneId=default"), { headers: { ...origin() } });
    expect(unauth.status).toBe(403);
    const cookie = await exchange();
    const bad = await fetch(url("/api/metrics?sceneId=bad%20id!!"), { headers: { Cookie: cookie } });
    expect(bad.status).toBe(400);
  });
});
