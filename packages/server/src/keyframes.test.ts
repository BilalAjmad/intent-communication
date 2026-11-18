import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./index";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

// trd 13.6: scene-wide keyframes table — GET returns it, PUT replaces it wholesale.
const testDir = tmpdir() + "/.test-keyframes-api";
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

let server: ReturnType<typeof createServer>;
let port = 0;

const url = (path: string) => `http://127.0.0.1:${port}${path}`;
const origin = () => ({ Origin: `http://127.0.0.1:${port}` });

function makeScene(revision: number) {
  return {
    version: 1,
    revision,
    createdAt: "2026-11-18T00:00:00.000Z",
    updatedAt: "2026-11-18T00:00:00.000Z",
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
    },
    screenOrder: [SCREEN],
    metadata: { name: "Keyframes Test", tags: [] },
  };
}

async function seed(): Promise<void> {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(testDir, ".intent", "scenes"), { recursive: true });
  await fs.writeFile(resolve(testDir, ".intent", "scenes", "default.json"), JSON.stringify(makeScene(2)), "utf-8");
  server = createServer({
    projectRoot: testDir,
    previewPort: 0,
    studioPort: 3459,
    mcpPort: 3460,
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

const VALID_KEYFRAMES = {
  "fade-up": {
    from: { opacity: "0", transform: "translateY(8px)" },
    to: { opacity: "1", transform: "translateY(0)" },
  },
};

describe("Keyframes API", () => {
  it("GET /api/keyframes returns the empty table and the current revision", async () => {
    const cookie = await exchange();
    const response = await fetch(url("/api/keyframes?sceneId=default"), { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; keyframes: Record<string, unknown>; revision: number };
    expect(body.ok).toBe(true);
    expect(body.keyframes).toEqual({});
    expect(body.revision).toBe(2);
  });

  it("PUT /api/keyframes replaces the table and bumps the revision", async () => {
    const cookie = await exchange();
    const put = await fetch(url("/api/keyframes?sceneId=default"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
      body: JSON.stringify({ sceneId: "default", baseRevision: 2, keyframes: VALID_KEYFRAMES }),
    });
    expect(put.status).toBe(200);
    const putBody = (await put.json()) as { ok: boolean; revision: number; keyframes: Record<string, unknown> };
    expect(putBody.ok).toBe(true);
    expect(putBody.revision).toBe(3);
    expect(putBody.keyframes).toEqual(VALID_KEYFRAMES);

    const get = await fetch(url("/api/keyframes?sceneId=default"), { headers: { Cookie: cookie } });
    const getBody = (await get.json()) as { keyframes: Record<string, unknown>; revision: number };
    expect(getBody.keyframes).toEqual(VALID_KEYFRAMES);
    expect(getBody.revision).toBe(3);
  });

  it("PUT /api/keyframes rejects a stale baseRevision with 409", async () => {
    const cookie = await exchange();
    const put = await fetch(url("/api/keyframes?sceneId=default"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
      body: JSON.stringify({ sceneId: "default", baseRevision: 1, keyframes: VALID_KEYFRAMES }),
    });
    expect(put.status).toBe(409);
    const body = (await put.json()) as { error: { code: string }; revision: number };
    expect(body.error.code).toBe("E_CONFLICT");
    expect(body.revision).toBe(2);
  });

  it("PUT /api/keyframes rejects an out-of-grammar name with a schema error", async () => {
    const cookie = await exchange();
    const put = await fetch(url("/api/keyframes?sceneId=default"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
      body: JSON.stringify({ sceneId: "default", baseRevision: 2, keyframes: { "bad name!": { from: { opacity: "0" } } } }),
    });
    expect(put.status).toBe(400);
  });

  it("PUT /api/keyframes rejects an out-of-grammar offset with a schema error", async () => {
    const cookie = await exchange();
    const put = await fetch(url("/api/keyframes?sceneId=default"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
      body: JSON.stringify({ sceneId: "default", baseRevision: 2, keyframes: { fade: { "150%": { opacity: "1" } } } }),
    });
    expect(put.status).toBe(400);
  });
});
