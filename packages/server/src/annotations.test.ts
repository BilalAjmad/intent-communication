import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./index";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

// trd 9.7 + 11.3: annotation API end to end — create, list, image upload,
// delete discipline, and the patch → send → annotation sent flip.
const testDir = tmpdir() + "/.test-annotations-api";
const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OBJECT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

let server: ReturnType<typeof createServer>;
let port = 0;

const url = (path: string) => `http://127.0.0.1:${port}${path}`;
const origin = () => ({ Origin: `http://127.0.0.1:${port}` });

function makePng(width = 1, height = 1): Buffer {
  const buf = Buffer.alloc(45, 0);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

async function seedScene(): Promise<void> {
  const scenesDir = resolve(testDir, ".intent", "scenes");
  await fs.mkdir(scenesDir, { recursive: true });
  const scene = {
    version: 1,
    revision: 1,
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
    metadata: { name: "Test", tags: [] },
  };
  await fs.writeFile(resolve(scenesDir, "default.json"), JSON.stringify(scene), "utf-8");
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

beforeEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  server = createServer({
    projectRoot: testDir,
    previewPort: 0,
    studioPort: 3457,
    mcpPort: 3458,
  });
  port = await server.start();
});

afterEach(async () => {
  if (server) {
    await server.stop();
  }
});

describe("Annotations API (trd 9.7)", () => {
  it("POST creates an open annotation with a_ id and returns it", async () => {
    const cookie = await exchange();
    const response = await fetch(url("/api/annotations?sceneId=default"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
      body: JSON.stringify({
        kind: "pin",
        objectId: OBJECT,
        screenId: SCREEN,
        anchor: { x: 100, y: 200 },
        text: "here is a problem",
      }),
    });
    expect(response.status).toBe(201);
    const body = (await response.json()) as { annotation: { id: string; status: string; kind: string } };
    expect(body.annotation.id).toMatch(/^a_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(body.annotation.status).toBe("open");
    expect(body.annotation.kind).toBe("pin");
  });

  it("POST rejects a pin without text and a pencil without strokes", async () => {
    const cookie = await exchange();
    for (const payload of [
      { kind: "pin", objectId: OBJECT, screenId: SCREEN, anchor: { x: 1, y: 1 } },
      { kind: "pencil", objectId: OBJECT, screenId: SCREEN, anchor: { x: 1, y: 1 } },
    ]) {
      const response = await fetch(url("/api/annotations?sceneId=default"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
        body: JSON.stringify(payload),
      });
      expect(response.status).toBe(400);
    }
  });

  it("GET lists annotations for the scene (filtered by screenId when asked)", async () => {
    const cookie = await exchange();
    await fetch(url("/api/annotations?sceneId=default"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
      body: JSON.stringify({ kind: "pin", objectId: OBJECT, screenId: SCREEN, anchor: { x: 1, y: 1 }, text: "t" }),
    });
    const all = (await (
      await fetch(url("/api/annotations?sceneId=default"), { headers: { Cookie: cookie } })
    ).json()) as { annotations: { screenId: string }[] };
    expect(all.annotations).toHaveLength(1);
    const other = (await (
      await fetch(url(`/api/annotations?sceneId=default&screenId=s_99ARZ3NDEKTSV4RRFFQ69G5FAV`), { headers: { Cookie: cookie } })
    ).json()) as { annotations: unknown[] };
    expect(other.annotations).toHaveLength(0);
  });

  it("PUT image stores a valid PNG and sets annotation.image; 204", async () => {
    const cookie = await exchange();
    const create = (await (
      await fetch(url("/api/annotations?sceneId=default"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
        body: JSON.stringify({
          kind: "pencil",
          objectId: OBJECT,
          screenId: SCREEN,
          anchor: { x: 1, y: 1 },
          strokes: [{ color: "red", width: 4, points: [[0, 0], [5, 5]] }],
        }),
      })
    ).json()) as { annotation: { id: string } };

    const png = makePng(3, 2);
    const put = await fetch(url(`/api/annotations/${create.annotation.id}/image?sceneId=default`), {
      method: "PUT",
      headers: { "Content-Type": "image/png", ...origin(), Cookie: cookie },
      body: png,
    });
    expect(put.status).toBe(204);

    const list = (await (
      await fetch(url("/api/annotations?sceneId=default"), { headers: { Cookie: cookie } })
    ).json()) as { annotations: { image?: { width: number; height: number; bytes: number } }[] };
    expect(list.annotations[0]?.image).toEqual({
      file: `${create.annotation.id}.png`,
      width: 3,
      height: 2,
      bytes: png.length,
    });
  });

  it("PUT image rejects wrong content-type and non-PNG bytes", async () => {
    const cookie = await exchange();
    const create = (await (
      await fetch(url("/api/annotations?sceneId=default"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
        body: JSON.stringify({
          kind: "pencil",
          objectId: OBJECT,
          screenId: SCREEN,
          anchor: { x: 1, y: 1 },
          strokes: [{ color: "red", width: 2, points: [[0, 0], [5, 5]] }],
        }),
      })
    ).json()) as { annotation: { id: string } };

    const wrongType = await fetch(url(`/api/annotations/${create.annotation.id}/image?sceneId=default`), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
      body: "{}",
    });
    expect(wrongType.status).toBe(415);

    const notPng = await fetch(url(`/api/annotations/${create.annotation.id}/image?sceneId=default`), {
      method: "PUT",
      headers: { "Content-Type": "image/png", ...origin(), Cookie: cookie },
      body: Buffer.from("not a png at all, definitely not"),
    });
    expect(notPng.status).toBe(400);
  });

  it("patch → send flips open annotations to sent; DELETE rejects sent with 409", { timeout: 15000 }, async () => {
    await seedScene();
    const cookie = await exchange();
    const create = (await (
      await fetch(url("/api/annotations?sceneId=default"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
        body: JSON.stringify({
          kind: "pin",
          objectId: OBJECT,
          screenId: SCREEN,
          anchor: { x: 10, y: 10 },
          text: "fix this please",
        }),
      })
    ).json()) as { annotation: { id: string } };
    const annotationId = create.annotation.id;

    // Create a feedback patch that REFERENCES the annotation.
    const patch = await fetch(url("/api/patches?sceneId=default"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
      body: JSON.stringify({
        sceneId: "default",
        objectId: OBJECT,
        baseRevision: 1,
        feedback: { annotationIds: [annotationId] },
      }),
    });
    expect(patch.status).toBe(201);

    // Send it.
    const send = await fetch(url("/api/patches/send?sceneId=default"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
      body: JSON.stringify({ sceneId: "default" }),
    });
    expect(send.status).toBe(200);

    // Annotation is now sent and DELETE refuses it.
    const list = (await (
      await fetch(url("/api/annotations?sceneId=default"), { headers: { Cookie: cookie } })
    ).json()) as { annotations: { id: string; status: string }[] };
    expect(list.annotations[0]?.status).toBe("sent");
    const del = await fetch(url(`/api/annotations/${annotationId}?sceneId=default`), {
      method: "DELETE",
      headers: { ...origin(), Cookie: cookie },
    });
    expect(del.status).toBe(409);
  });

  it("DELETE removes an open annotation", async () => {
    const cookie = await exchange();
    const create = (await (
      await fetch(url("/api/annotations?sceneId=default"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
        body: JSON.stringify({
          kind: "pin",
          objectId: OBJECT,
          screenId: SCREEN,
          anchor: { x: 1, y: 1 },
          text: "temporary note",
        }),
      })
    ).json()) as { annotation: { id: string } };
    const del = await fetch(url(`/api/annotations/${create.annotation.id}?sceneId=default`), {
      method: "DELETE",
      headers: { ...origin(), Cookie: cookie },
    });
    expect(del.status).toBe(200);
    const list = (await (
      await fetch(url("/api/annotations?sceneId=default"), { headers: { Cookie: cookie } })
    ).json()) as { annotations: unknown[] };
    expect(list.annotations).toHaveLength(0);
  });

  it("unauthenticated POST is refused", async () => {
    const response = await fetch(url("/api/annotations?sceneId=default"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin() },
      body: JSON.stringify({ kind: "pin", objectId: OBJECT, screenId: SCREEN, anchor: { x: 1, y: 1 }, text: "t" }),
    });
    expect(response.status).toBe(403);
  });
});
