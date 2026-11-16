import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./index";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

// trd 6.x: snapshots saved before every send; list + restore via the Studio.
const testDir = tmpdir() + "/.test-versions-api";
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

let server: ReturnType<typeof createServer>;
let port = 0;

const url = (path: string) => `http://127.0.0.1:${port}${path}`;
const origin = () => ({ Origin: `http://127.0.0.1:${port}` });

function makeScene(name: string, revision: number) {
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
    },
    screenOrder: [SCREEN],
    metadata: { name, tags: [] },
  };
}

const VERSION_FILE = "2026-11-16T00-00-00-000Z-r1-before-send.json";

async function seed(): Promise<void> {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(testDir, ".intent", "scenes"), { recursive: true });
  await fs.mkdir(resolve(testDir, ".intent", "versions"), { recursive: true });
  await fs.writeFile(resolve(testDir, ".intent", "scenes", "default.json"), JSON.stringify(makeScene("Versions Test", 2)), "utf-8");
  await fs.writeFile(resolve(testDir, ".intent", "versions", VERSION_FILE), JSON.stringify(makeScene("Restored Version", 1)), "utf-8");
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

beforeEach(seed);
afterEach(async () => {
  if (server) await server.stop();
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

describe("Versions API", () => {
  it("GET /api/versions lists snapshots, newest first", async () => {
    const cookie = await exchange();
    const response = await fetch(url("/api/versions?sceneId=default"), { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { versions: { file: string; revision: number; bytes: number }[] };
    expect(body.versions).toHaveLength(1);
    expect(body.versions[0]?.file).toBe(VERSION_FILE);
    expect(body.versions[0]?.revision).toBe(1);
    expect(body.versions[0]?.bytes).toBeGreaterThan(0);
  });

  it("GET /api/versions returns an empty list when the versions dir is missing", async () => {
    await fs.rm(resolve(testDir, ".intent", "versions"), { recursive: true, force: true });
    const cookie = await exchange();
    const response = await fetch(url("/api/versions?sceneId=default"), { headers: { Cookie: cookie } });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { versions: unknown[] };
    expect(body.versions).toEqual([]);
  });

  it("POST /api/versions/:file/restore replaces the scene, bumping revision", async () => {
    const cookie = await exchange();
    const response = await fetch(url(`/api/versions/${VERSION_FILE}/restore?sceneId=default`), {
      method: "POST",
      headers: { ...origin(), Cookie: cookie },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; revision: number };
    expect(body.ok).toBe(true);
    expect(body.revision).toBe(3); // current 2 + 1

    const scene = JSON.parse(
      await fs.readFile(resolve(testDir, ".intent", "scenes", "default.json"), "utf-8"),
    ) as { revision: number; metadata: { name: string } };
    expect(scene.metadata.name).toBe("Restored Version");
    expect(scene.revision).toBe(3);
  });

  it("POST restore rejects invalid file names and missing snapshots", async () => {
    const cookie = await exchange();
    // Path traversal is rejected by the transport before routing (403) — never reaches the handler.
    const bad = await fetch(url("/api/versions/..%2Fconfig.json/restore?sceneId=default"), {
      method: "POST",
      headers: { ...origin(), Cookie: cookie },
    });
    expect(bad.status).toBe(403);
    // An invalid (non-traversal) file name reaches the handler and is rejected with 400.
    const badName = await fetch(url("/api/versions/nope.json/restore?sceneId=default"), {
      method: "POST",
      headers: { ...origin(), Cookie: cookie },
    });
    expect(badName.status).toBe(400);
    const missing = await fetch(url("/api/versions/2099-01-01T00-00-00-000Z-r9-before-send.json/restore?sceneId=default"), {
      method: "POST",
      headers: { ...origin(), Cookie: cookie },
    });
    expect(missing.status).toBe(404);
  });

  it("POST restore rejects an unauthenticated request", async () => {
    const response = await fetch(url(`/api/versions/${VERSION_FILE}/restore?sceneId=default`), {
      method: "POST",
      headers: { ...origin() },
    });
    expect(response.status).toBe(403);
  });
});
