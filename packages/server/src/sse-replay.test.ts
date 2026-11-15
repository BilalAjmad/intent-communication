import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./index";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

// TC-SRV-04 — SSE: Last-Event-ID replay of the last 100 events; a larger gap sends "resync".

describe("SSE replay (TC-SRV-04)", () => {
  const testDir = resolve(tmpdir(), `.test-server-sse-replay-${Date.now()}`);
  let server: ReturnType<typeof createServer>;
  let port = 0;
  const sceneId = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
  const objectId = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    const scenesDir = resolve(testDir, ".intent", "scenes");
    await fs.mkdir(scenesDir, { recursive: true });
    const scene = {
      version: 1,
      revision: 1,
      createdAt: "2026-11-13T00:00:00.000Z",
      updatedAt: "2026-11-13T00:00:00.000Z",
      screens: {},
      objects: {
        [objectId]: { id: objectId, type: "text", parentId: null, children: [], props: { content: "Hello" }, style: {}, meta: {} },
      },
      screenOrder: [],
      metadata: { name: "Replay", tags: [] },
    };
    await fs.writeFile(resolve(scenesDir, "s_01ARZ3NDEKTSV4RRFFQ69G5FAV.json"), JSON.stringify(scene), "utf-8");
    server = createServer({ projectRoot: testDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
    port = await server.start();
  });

  afterEach(async () => {
    if (server) await server.stop();
  });

  const url = (path: string) => `http://127.0.0.1:${port}${path}`;
  const origin = () => ({ Origin: `http://127.0.0.1:${port}` });

  async function exchangeCookie() {
    const exchange = await fetch(url("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin() },
      body: JSON.stringify({ token: server.getSessionToken() }),
    });
    expect(exchange.status).toBe(204);
    return (exchange.headers.get("Set-Cookie") ?? "").split(";")[0];
  }

  it("replays the events after Last-Event-ID on reconnect, including events from other scenes' channels", async () => {
    const cookie = await exchangeCookie();

    // Subscribe a fresh client; read the seed event to learn the id sequence
    const controller = new AbortController();
    const res = await fetch(url(`/api/events?scene=${sceneId}`), { headers: { Cookie: cookie }, signal: controller.signal });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const firstDeadline = Date.now() + 3000;
    while (Date.now() < firstDeadline && !/id: \d+/.exec(buffer)) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    const firstIdMatch = /id: (\d+)/.exec(buffer);
    expect(firstIdMatch).not.toBeNull();
    const firstId = Number(firstIdMatch![1]);
    controller.abort();

    // Broadcast some events directly (patch.changed x2, then a revision bump)
    server.broadcastPatchChanged(sceneId, "p_a", "sent");
    server.broadcastPatchChanged(sceneId, "p_b", "draft");
    server.broadcastRevision(sceneId, 2);

    // Reconnect with Last-Event-ID = first event id; expect both patch.changed events + revision replayed
    const res2 = await fetch(url(`/api/events?scene=${sceneId}`), {
      headers: { Cookie: cookie, "Last-Event-ID": String(firstId) },
    });
    expect(res2.status).toBe(200);
    const reader2 = res2.body!.getReader();
    let replayBuffer = "";
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && !(replayBuffer.includes("p_b") && replayBuffer.includes('"revision":2'))) {
      const { value, done } = await reader2.read();
      if (done) break;
      replayBuffer += decoder.decode(value, { stream: true });
    }
    expect(replayBuffer).toContain("patch.changed");
    expect(replayBuffer).toContain("p_a");
    expect(replayBuffer).toContain("p_b");
    expect(replayBuffer).toContain('"revision":2');
  });

  it("sends resync when the client fell behind by more than the 100-event window", async () => {
    const cookie = await exchangeCookie();

    // Flood the ring with 120 events so the client window is exhausted
    for (let i = 0; i < 120; i++) {
      server.broadcastPatchChanged(sceneId, `p_${i}`, "draft");
    }

    // Reconnect with a Last-Event-ID far behind the retained window (id 1)
    const res = await fetch(url(`/api/events?scene=${sceneId}`), {
      headers: { Cookie: cookie, "Last-Event-ID": "1" },
    });
    expect(res.status).toBe(200);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && !buffer.includes("resync")) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    expect(buffer).toContain('"type":"resync"');
  });
});
