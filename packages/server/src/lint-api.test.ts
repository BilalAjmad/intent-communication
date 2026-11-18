import { describe, it, expect, afterEach } from "vitest";
import { createServer } from "./index";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

// trd 11.3: GET /api/lint — session-authed lint verdict for the current scene.
const testDir = tmpdir() + "/.test-lint-api";
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BUTTON = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

let server: ReturnType<typeof createServer>;
let port = 0;

const url = (path: string) => `http://127.0.0.1:${port}${path}`;
const origin = () => ({ Origin: `http://127.0.0.1:${port}` });

function makeScene(withViolation: boolean) {
  const button = {
    id: BUTTON,
    type: "button",
    parentId: SCREEN,
    children: [],
    props: { label: "Go", variant: "primary" },
    style: {},
    meta: {},
    ...(withViolation ? {} : { states: { loading: { style: { opacity: 0.6 } } } }),
  };
  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [BUTTON],
        props: { title: "S", width: 1280, height: 720 },
        style: {}, meta: {},
      },
    },
    objects: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [BUTTON],
        props: { title: "S", width: 1280, height: 720 },
        style: {}, meta: {},
      },
      [BUTTON]: button,
    },
    screenOrder: [SCREEN],
    metadata: { name: "Lint Test", tags: [] },
  };
}

/** A text object with a raw hex color — used to exercise the design-profile wiring. */
function makeColorScene() {
  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-16T00:00:00.000Z",
    updatedAt: "2026-11-16T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [BUTTON],
        props: { title: "S", width: 1280, height: 720 },
        style: {}, meta: {},
      },
    },
    objects: {
      [SCREEN]: {
        id: SCREEN, type: "screen", parentId: null, children: [BUTTON],
        props: { title: "S", width: 1280, height: 720 },
        style: {}, meta: {},
      },
      [BUTTON]: {
        id: BUTTON, type: "text", parentId: SCREEN, children: [],
        props: { content: "Hello", fontSize: 16 },
        style: { color: "#2464ec" },
        meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Lint Color Test", tags: [] },
  };
}

async function seed(scene: object): Promise<void> {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(testDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(testDir, ".intent", "scenes", "default.json"), JSON.stringify(scene), "utf-8");
  server = createServer({ projectRoot: testDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
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

afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

describe("Lint API (trd 11.3)", () => {
  it("with a design profile, suggests the nearest profile token for a raw color", async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    await fs.mkdir(resolve(testDir, ".intent", "scenes"), { recursive: true });
    await fs.writeFile(resolve(testDir, ".intent", "scenes", "default.json"), JSON.stringify(makeColorScene()), "utf-8");
    await fs.writeFile(
      resolve(testDir, ".intent", "design-profile.json"),
      JSON.stringify({ schemaVersion: 1, generatedAt: "2026-11-16T00:00:00.000Z", sources: [], tokens: { colors: { primary: "#2563eb" }, spacing: {}, radii: {}, fontFamily: {}, fontSize: {} }, components: [], unresolved: [] }),
      "utf-8",
    );
    server = createServer({ projectRoot: testDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
    port = await server.start();
    const cookie = await exchange();
    const response = await fetch(url("/api/lint?sceneId=default"), { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { violations: { ruleId: string; suggestion?: string }[] };
    const token = body.violations.find((v) => v.ruleId === "L-TOKEN");
    expect(token?.suggestion).toContain("token.color.primary");
  });

  it("returns lint violations with rule ids for a broken scene", async () => {
    await seed(makeScene(true));
    const cookie = await exchange();
    const response = await fetch(url("/api/lint?sceneId=default"), { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      revision: number;
      pass: boolean;
      violations: { ruleId: string; objectId: string }[];
    };
    expect(body.revision).toBe(1);
    expect(body.pass).toBe(false);
    const ruleIds = body.violations.map((v) => v.ruleId);
    expect(ruleIds).toContain("L-STATES");
  });

  it("returns pass:true and zero violations for a clean scene", async () => {
    await seed(makeScene(false));
    const cookie = await exchange();
    const response = await fetch(url("/api/lint?sceneId=default"), { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { pass: boolean; violations: unknown[] };
    expect(body.pass).toBe(true);
    expect(body.violations).toEqual([]);
  });

  it("404s for a missing scene", async () => {
    await seed(makeScene(true));
    await fs.rm(resolve(testDir, ".intent", "scenes", "default.json"), { force: true });
    const cookie = await exchange();
    const response = await fetch(url("/api/lint?sceneId=default"), { headers: { Cookie: cookie } });
    expect(response.status).toBe(404);
  });

  it("400s for an invalid sceneId", async () => {
    await seed(makeScene(true));
    const cookie = await exchange();
    const response = await fetch(url("/api/lint?sceneId=bad.id!"), { headers: { Cookie: cookie } });
    expect(response.status).toBe(400);
  });

  it("403s without a session", async () => {
    await seed(makeScene(true));
    const response = await fetch(url("/api/lint?sceneId=default"));
    expect(response.status).toBe(403);
  });
});
