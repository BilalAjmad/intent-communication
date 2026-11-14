import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./index";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

// End-to-end SSE flow (S-1-12, AC-M1-09).
//
// Opens a real /events stream with the session cookie, reads the initial
// revision event, applies a valid patch via /mcp, and verifies the SSE stream
// receives the new revision event.

describe("SSE end-to-end (S-1-12)", () => {
  const testDir = resolve(tmpdir(), `.test-server-sse-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  let server: ReturnType<typeof createServer>;
  let port = 0;
  const sceneId = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const objectId = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});

    // Seed the default scene with one text object at revision 1
    const scenesDir = resolve(testDir, ".intent", "scenes");
    await fs.mkdir(scenesDir, { recursive: true });
    const scene = {
      version: 1,
      revision: 1,
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
      metadata: { name: "SSE Test", tags: [] },
    };
    await fs.writeFile(resolve(scenesDir, "s_01ARZ3NDEKTSV4RRFFQ69G5FAV.json"), JSON.stringify(scene), "utf-8");

    server = createServer({ projectRoot: testDir, previewPort: 0, studioPort: 3457, mcpPort: 3458 });
    port = await server.start();
  });

  afterEach(async () => {
    if (server) await server.stop();
  });

  const url = (path: string) => `http://127.0.0.1:${port}${path}`;
  const origin = () => ({ Origin: `http://127.0.0.1:${port}` });

  it("emits revision events on the authenticated /events stream after an /mcp patch", async () => {
    // Exchange for a session cookie
    const token = server.getSessionToken();
    const exchange = await fetch(url("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin() },
      body: JSON.stringify({ token }),
    });
    expect(exchange.status).toBe(204);
    const sessionCookie = (exchange.headers.get("Set-Cookie") ?? "").split(";")[0];

    // Open the SSE stream
    const controller = new AbortController();
    const sseResponse = await fetch(url(`/events?scene=${sceneId}`), {
      headers: { Cookie: sessionCookie },
      signal: controller.signal,
    });
    expect(sseResponse.status).toBe(200);
    expect(sseResponse.headers.get("Content-Type")).toContain("text/event-stream");

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

    // First chunk: retry + initial revision event
    await waitFor("retry:");
    await waitFor('"type":"revision"');
    expect(buffer).toContain('"revision":1');

    // Apply a valid patch through /mcp
    const patch = {
      id: "p_01ARZ3NDEKTSV4RRFFQ69G5FAV",
      sceneId,
      baseRevision: 1,
      objectId,
      op: "set",
      path: "props.content",
      value: "Hello SSE",
      createdAt: "2026-11-13T00:00:00.000Z",
      status: "pending",
    };

    const patchResponse = await fetch(url("/mcp"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin(), Cookie: sessionCookie },
      body: JSON.stringify({ tool: "apply_patch", input: { patch } }),
    });
    const patchResult = (await patchResponse.json()) as { success: boolean; result?: { success?: boolean; revision?: number } };
    expect(patchResponse.status).toBe(200);
    expect(patchResult.success).toBe(true);

    // The SSE stream must subsequently emit revision 2
    await waitFor('"revision":2');
    expect(buffer).toContain('"type":"revision"');

    controller.abort();
  });
});
