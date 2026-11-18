import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./index";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

// trd 9.4 — the Studio server watches .intent/ and emits SSE events when the
// scene file changes OUTSIDE a server API call (a user hand-editing scene.json,
// or another tool writing it). The Studio then refetches and shows the new state.
describe("File watcher → SSE (trd 9.4, TC-WRT-11)", () => {
  const testDir = resolve(tmpdir(), `.test-server-watch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  let server: ReturnType<typeof createServer>;
  let port = 0;
  const sceneId = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const objectId = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

  const scenePath = () => resolve(testDir, ".intent", "scenes", `${sceneId}.json`);
  const makeScene = (revision: number) => ({
    version: 1,
    revision,
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    screens: {},
    objects: {
      [objectId]: {
        id: objectId,
        type: "text",
        parentId: null,
        children: [],
        props: { content: "Hello" },
        style: {},
        meta: {},
      },
    },
    screenOrder: [],
    metadata: { name: "Watch Test", tags: [] },
  });

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    const scenesDir = resolve(testDir, ".intent", "scenes");
    await fs.mkdir(scenesDir, { recursive: true });
    await fs.writeFile(scenePath(), JSON.stringify(makeScene(1)), "utf-8");
    server = createServer({ projectRoot: testDir, previewPort: 0, studioPort: 3457, mcpPort: 3458 });
    port = await server.start();
  });

  afterEach(async () => {
    if (server) await server.stop();
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  const url = (path: string) => `http://127.0.0.1:${port}${path}`;
  const origin = () => ({ Origin: `http://127.0.0.1:${port}` });

  it("notices a hand-edit to scenes/<id>.json and emits a revision event", async () => {
    const token = server.getSessionToken();
    const exchange = await fetch(url("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin() },
      body: JSON.stringify({ token }),
    });
    expect(exchange.status).toBe(204);
    const sessionCookie = (exchange.headers.get("Set-Cookie") ?? "").split(";")[0];

    const controller = new AbortController();
    const sseResponse = await fetch(url(`/api/events?scene=${sceneId}`), {
      headers: { Cookie: sessionCookie },
      signal: controller.signal,
    });
    expect(sseResponse.status).toBe(200);

    const reader = sseResponse.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    async function waitFor(pattern: RegExp | string, timeoutMs = 8000): Promise<string> {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        if (buffer.match(pattern instanceof RegExp ? pattern : new RegExp(String(pattern).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))) {
          return buffer;
        }
        const { value, done } = await reader.read();
        if (done) throw new Error("SSE stream ended before pattern was seen");
        buffer += decoder.decode(value, { stream: true });
      }
      throw new Error(`Timed out waiting for ${pattern}; got: ${buffer}`);
    }

    await waitFor('"type":"revision"');
    expect(buffer).toContain('"revision":1');

    // Hand-edit the scene file, outside the server (simulates an external tool).
    await fs.writeFile(scenePath(), JSON.stringify(makeScene(2)), "utf-8");

    await waitFor('"revision":2');
    controller.abort();
  });
});
