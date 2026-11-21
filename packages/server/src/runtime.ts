import { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { StoragePort } from "@intent/core";

/** One entry in the SSE event ring (trd 11.4). */
export interface SseEvent {
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  sceneId: string | null;
}

/** Runtime dependencies for the SSE stream and the static file server. */
export interface RuntimeContext {
  storage: StoragePort;
  /** Live SSE clients keyed by scene id. Mutated by both the server and this module. */
  sseClients: Map<string, { response: ServerResponse; sceneId: string; lastEventId: number }[]>;
  /** Current in-memory revision; mutated when patches broadcast. */
  getRevision: () => number;
  setRevision: (revision: number) => void;
  staticDir: string;
  projectRoot: string;
  sessionToken: string;
  /** Live ring of the most recent events (max 100). */
  eventLog: SseEvent[];
  /** Append an event to the ring and return its seq (used as the SSE `id`). */
  emitEvent: (type: string, payload: Record<string, unknown>) => number;
  /** Write an event to ONE response without touching the shared ring. */
  writeDirect: (res: ServerResponse, type: string, payload: Record<string, unknown>) => number;
}

function writeSseEvent(res: ServerResponse, seq: number, type: string, payload: Record<string, unknown>): void {
  res.write(`id: ${seq}\n`);
  res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
}

/** GET /api/events — SSE stream for a scene (trd 11.4).
 *  Fresh subscribers receive one seed revision event; reconnecting clients
 *  with `Last-Event-ID` receive the events after that id (up to 100);
 *  a larger gap receives a single `resync` event. */
export async function handleSSE(ctx: RuntimeContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const rawScene = url.searchParams.get("scene");
  const sceneId = !rawScene ? "default" : /^[A-Za-z0-9_-]{1,120}$/.test(rawScene) ? rawScene : null;
  if (!sceneId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: { code: "E_BAD_REQUEST", message: "Invalid scene id" } }));
    return;
  }
  const lastEventIdHeader = req.headers["last-event-id"];
  const lastEventIdValue = Array.isArray(lastEventIdHeader) ? lastEventIdHeader[0] : lastEventIdHeader;
  const lastEventId = parseInt(lastEventIdValue || "0", 10);

  // Seed the in-memory revision from the actual scene so the first event
  // emits the current revision (not the default 0).
  try {
    const scene = await ctx.storage.readScene(sceneId);
    if (scene && typeof scene.revision === "number" && scene.revision >= ctx.getRevision()) {
      ctx.setRevision(scene.revision);
    }
  } catch {
    // Non-fatal: client still receives an event with revision 0.
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(`retry: 1000\n\n`);

  // trd 11.4: keepalive ping comment every 20s
  const ping = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(ping);
    }
  }, 20000);

  const client = { response: res, sceneId, lastEventId: Number.isFinite(lastEventId) ? lastEventId : 0 };
  const clients = ctx.sseClients.get(sceneId) || [];
  clients.push(client);
  // Hard cap per scene — beyond it, evict the oldest connection rather than grow without bound.
  if (clients.length > 64) {
    const evicted = clients.shift();
    try { evicted?.response.end(); } catch { /* already gone */ }
  }
  ctx.sseClients.set(sceneId, clients);

  // Register the close handler BEFORE any write that may throw — a dead socket
  // between insertion and replay must never pin a 20s interval + client entry.
  req.on("close", () => {
    clearInterval(ping);
    const list = ctx.sseClients.get(sceneId) || [];
    const idx = list.indexOf(client);
    if (idx !== -1) list.splice(idx, 1);
    if (list.length === 0) ctx.sseClients.delete(sceneId);
  });

  if (Number.isFinite(lastEventId) && lastEventId > 0 && ctx.eventLog.length > 0) {
    // Reconnect: replay events newer than the client's last seen id — only
    // events for THIS scene plus project-wide ones; never other scenes' patches.
    const relevant = ctx.eventLog.filter((ev) => ev.sceneId === null || ev.sceneId === sceneId);
    // Gap accounting against the oldest scene-relevant event, not the global
    // ring's oldest — other scenes' evictions must not force a resync.
    const oldest = relevant[0]?.seq ?? ctx.eventLog[0]!.seq;
    if (ctx.eventLog.length >= 100 && lastEventId < oldest - 1) {
      // Gap larger than the replay window — tell the client to refetch everything.
      ctx.writeDirect(res, "resync", {});
    } else {
      try {
        for (const ev of relevant) {
          if (ev.seq > lastEventId) {
            writeSseEvent(res, ev.seq, ev.type, ev.payload);
          }
        }
      } catch {
        // Client died mid-replay — its close handler does the cleanup.
      }
    }
  } else {
    // Fresh subscriber: one seed event with the current revision.
    ctx.writeDirect(res, "revision", { revision: ctx.getRevision() });
  }
}

/** The SPA file server. Path traversal is refused; "/" serves index.html (no-store); unknown paths 404. */
export async function serveStatic(ctx: RuntimeContext, req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  const staticDir = ctx.staticDir;

  // Check for path traversal attempts BEFORE resolving
  if (pathname.includes("..")) {
    res.writeHead(403);
    res.end("Forbidden: Path traversal not allowed");
    return;
  }

  const filePath = resolve(staticDir, pathname.slice(1) || "index.html");
  const normalizedStaticDir = resolve(staticDir);
  const normalizedFilePath = resolve(filePath);
  if (!normalizedFilePath.startsWith(normalizedStaticDir + sep) && normalizedFilePath !== normalizedStaticDir) {
    res.writeHead(403);
    res.end("Forbidden: Path traversal not allowed");
    return;
  }

  try {
    const content = await readFile(normalizedFilePath);
    const ext = extname(normalizedFilePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".mjs": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    };
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      ...(pathname === "/" || pathname.endsWith("/index.html") ? { "Cache-Control": "no-store" } : {}),
    });
    res.end(content);
    return;
  } catch {
    // SPA is served at "/" only; no deep-link fallback (every 404 here is a plain 404)
    if (pathname === "/" || pathname === "/index.html") {
      try {
        const content = await readFile(resolve(staticDir, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
        res.end(content);
        return;
      } catch {
        // fall through to 404
      }
    }
    res.writeHead(404);
    res.end("Not Found");
  }
}

/** trd 5: the Studio writes .intent/runtime.json so agents can discover the exact URL/token. */
export async function writeRuntimeFile(ctx: Pick<RuntimeContext, "projectRoot" | "sessionToken">, port: number): Promise<void> {
  try {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const intentDir = resolve(ctx.projectRoot, ".intent");
    await mkdir(intentDir, { recursive: true });
    const runtime = { port, pid: process.pid, token: ctx.sessionToken, startedAt: new Date().toISOString() };
    await writeFile(resolve(intentDir, "runtime.json"), JSON.stringify(runtime, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch {
    // Best effort — failure must not take down the server
  }
}
