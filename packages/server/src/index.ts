import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolve, extname, sep } from "node:path";
import {
  StoragePort,
  LockPort,
  CryptoPort,
  IntentError,
  ErrorCodes,
} from "@intent/core";
import { Config, Patch } from "@intent/schema";
import { createFileStoragePort, createFileLockPort, createNodeCryptoPort } from "@intent/adapters-node";
import { handleMCPRequest } from "@intent/mcp-server";

export interface ServerConfig {
  projectRoot: string;
  previewPort: number;
  studioPort: number;
  mcpPort: number;
  staticDir?: string;
  /**
   * Per-run token required for the /api session exchange (trd 11.2).
   * If omitted, the server generates one at construction time and writes it
   * to `.intent/runtime.json` on `start()`.
   */
  sessionToken?: string;
  /** Idle timeout for a session cookie, in seconds (trd 11.2: Path=/api). */
  sessionMaxAgeSeconds?: number;
}

export interface SSEClient {
  response: ServerResponse;
  sceneId: string;
  lastEventId: number;
}

export class IntentServer {
  private config: ServerConfig;
  private storage: StoragePort;
  private lockPort: LockPort;
  private crypto: CryptoPort;
  private sseClients: Map<string, SSEClient[]> = new Map();
  private httpServer: ReturnType<typeof createHttpServer>;
  private revision: number = 0;
  private sessionToken: string;
  private sessionMaxAgeSeconds: number;
  /** Known live session ids -> createdAt (ms). */
  private sessions: Map<string, number> = new Map();

  constructor(config: ServerConfig) {
    this.config = config;
    this.storage = createFileStoragePort(config.projectRoot);
    this.lockPort = createFileLockPort(config.projectRoot);
    this.crypto = createNodeCryptoPort();
    this.httpServer = createHttpServer(this.handleRequest.bind(this));
    this.sessionToken =
      config.sessionToken ?? randomBytes(32).toString("hex");
    this.sessionMaxAgeSeconds = config.sessionMaxAgeSeconds ?? 1800;
  }

  /** The session token the /api exchange requires. Written to runtime.json by start(). */
  getSessionToken(): string {
    return this.sessionToken;
  }

  getConfig(): ServerConfig {
    return this.config;
  }

  /** The address the HTTP server bound to, or null if not started. */
  addressOf(): ReturnType<ReturnType<typeof createHttpServer>["address"]> {
    return this.httpServer.address();
  }

  private setSecurityHeaders(res: ServerResponse) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
    );
  }

  /** Reads a request body with a hard byte cap. Throws { code: "E_LIMIT" } on overflow. */
  private async readBody(req: IncomingMessage, limit: number): Promise<string> {
    let size = 0;
    let body = "";
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > limit) {
        throw Object.assign(new Error("request body too large"), { code: "E_LIMIT" });
      }
      body += (chunk as Buffer).toString("utf-8");
    }
    return body;
  }

  /** Host must be exactly 127.0.0.1:<port> or localhost:<port> (trd 11.2). */
  private checkHost(req: IncomingMessage): boolean {
    const host = req.headers.host;
    if (!host) return false;
    const port = this.config.previewPort;
    return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
  }

  /**
   * Non-GET requests must carry an Origin equal to http://<that host>
   * (trd 11.2 step 4). A missing Origin on a non-GET is refused.
   */
  private checkMethodOrigin(req: IncomingMessage): boolean {
    const method = (req.method || "GET").toUpperCase();
    if (method === "GET" || method === "HEAD") return true;
    const origin = req.headers.origin;
    if (!origin) return false;
    const port = this.config.previewPort;
    return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
  }

  private readSessionCookie(req: IncomingMessage): string | null {
    const raw = req.headers.cookie || "";
    for (const part of raw.split(";")) {
      const trimmed = part.trim();
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      if (trimmed.slice(0, eq) === "intent_session") {
        return trimmed.slice(eq + 1);
      }
    }
    return null;
  }

  /** True iff the request carries a live, unexpired session cookie (trd 11.2). */
  private isValidSession(req: IncomingMessage): boolean {
    const id = this.readSessionCookie(req);
    if (!id) return false;
    for (const [live, createdAt] of this.sessions) {
      if (live.length === id.length) {
        const a = Buffer.from(id);
        const b = Buffer.from(live);
        if (timingSafeEqual(a, b)) {
          if (Date.now() - createdAt <= this.sessionMaxAgeSeconds * 1000) {
            return true;
          }
          this.sessions.delete(live);
          return false;
        }
      }
    }
    return false;
  }

  /** True iff the request carries a live, unexpired session cookie (trd 11.2). */
  private isAuthorized(req: IncomingMessage): boolean {
    // Host and Origin are enforced once for every route in handleRequest;
    // by the time we reach here those checks have already passed.
    return this.isValidSession(req);
  }

  /** Full request gate for every route except the session exchange and health. */
  private requireSession(req: IncomingMessage, res: ServerResponse): boolean {
    if (this.isAuthorized(req)) return true;
    res.writeHead(403, { "Content-Type": "application/json" });
    // trd 11.2: "Anything else returns 403 with no detail"
    res.end(JSON.stringify({ error: "Forbidden" }));
    return false;
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const rawUrl = req.url || "";
    const url = new URL(rawUrl, `http://127.0.0.1:${this.config.previewPort}`);
    const pathname = url.pathname;

    // Early path traversal check on raw URL (before URL normalization)
    if (rawUrl.includes("..")) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    // trd 11.3: preflight is refused; no CORS headers are sent.
    if ((req.method || "GET").toUpperCase() === "OPTIONS") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    // trd 11.2 step 4: exact Host on every route, and an Origin that matches
    // that host on every non-GET. Anything else is 403 with no detail.
    if (!this.checkHost(req)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }
    if (!this.checkMethodOrigin(req)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden" }));
      return;
    }

    this.setSecurityHeaders(res);

    // Session exchange (trd 11.2 step 2): Host must be exact, the token is
    // compared in constant time, and the cookie carries a random session id,
    // never the token itself.
    if (pathname === "/api/session" && req.method === "POST") {
      let body: string;
      try {
        body = await this.readBody(req, 16 * 1024);
      } catch {
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payload too large" }));
        return;
      }
      try {
        const { token } = JSON.parse(body) as { token?: unknown };
        const expected = Buffer.from(this.sessionToken, "utf-8");
        const given = Buffer.from(typeof token === "string" ? token : "", "utf-8");
        const ok = given.length === expected.length && timingSafeEqual(given, expected);
        if (!ok) {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Forbidden" }));
          return;
        }
        const sessionId = randomBytes(32).toString("hex");
        this.sessions.set(sessionId, Date.now());
        res.setHeader(
          "Set-Cookie",
          `intent_session=${sessionId}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${this.sessionMaxAgeSeconds}`
        );
        res.writeHead(204);
        res.end();
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Bad Request" }));
      }
      return;
    }

    // Health: Host and Origin are already checked above; reveals only
    // "the server is up".
    if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", revision: this.revision }));
      return;
    }

    // Every other route: exact Host, a live session cookie, and (for non-GET)
    // a matching Origin (trd 11.2 step 4). Refused with no detail otherwise.
    if (!this.requireSession(req, res)) return;

    if (pathname === "/api/protected") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // SSE endpoint
    if (pathname === "/events") {
      await this.handleSSE(req, res, url);
      return;
    }

    // MCP endpoint
    if (pathname === "/mcp" && req.method === "POST") {
      this.handleMCP(req, res);
      return;
    }

    // Static file serving
    await this.serveStatic(req, res, pathname);
  }

  private async handleSSE(req: IncomingMessage, res: ServerResponse, url: URL) {
    const sceneId = url.searchParams.get("scene") || "default";
    const lastEventIdHeader = req.headers["last-event-id"];
    const lastEventIdValue = Array.isArray(lastEventIdHeader) ? lastEventIdHeader[0] : lastEventIdHeader;
    const lastEventId = parseInt(lastEventIdValue || "0", 10);

    // Seed the in-memory revision from the actual scene so the first event
    // emits the current revision (not the default 0).
    try {
      const scene = await this.storage.readScene(sceneId);
      if (scene && typeof scene.revision === "number" && scene.revision >= this.revision) {
        this.revision = scene.revision;
      }
    } catch {
      // Non-fatal: client still receives an event with revision 0.
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    res.write(`retry: 1000\n\n`);

    const client: SSEClient = { response: res, sceneId, lastEventId };
    const clients = this.sseClients.get(sceneId) || [];
    clients.push(client);
    this.sseClients.set(sceneId, clients);

    res.write(`id: ${this.revision}\n`);
    res.write(`data: ${JSON.stringify({ type: "revision", revision: this.revision })}\n\n`);

    req.on("close", () => {
      const clients = this.sseClients.get(sceneId) || [];
      const idx = clients.indexOf(client);
      if (idx !== -1) clients.splice(idx, 1);
    });
  }

  private async handleMCP(req: IncomingMessage, res: ServerResponse) {
    let body: string;
    try {
      body = await this.readBody(req, 2 * 1024 * 1024);
    } catch {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Payload too large" }));
      return;
    }
    try {
      const { tool, input } = JSON.parse(body);
      let patchSceneId: string | undefined;
      if (tool === "apply_patch" && input && typeof input === "object") {
        const maybePatch = (input as { patch?: unknown }).patch as { sceneId?: unknown } | undefined;
        if (maybePatch && typeof maybePatch.sceneId === "string") {
          patchSceneId = maybePatch.sceneId;
        }
      }
      const result = await handleMCPRequest(tool, input, {
        projectRoot: this.config.projectRoot,
        storage: this.storage,
        lockPort: this.lockPort,
        crypto: this.crypto,
      });
      // Real-time studio: after a successful patch, broadcast the new revision
      // to any connected SSE clients (S-1-12).
      if (
        tool === "apply_patch" &&
        patchSceneId &&
        result &&
        typeof result === "object" &&
        (result as { success?: boolean; revision?: number }).success === true &&
        typeof (result as { revision?: number }).revision === "number"
      ) {
        this.broadcastRevision(patchSceneId, (result as { revision: number }).revision);
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, result }));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: (error as Error).message }));
    }
  }

  private async serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string) {
    const staticDir = this.config.staticDir || resolve(this.config.projectRoot, ".intent", "studio");
    
    // Check for path traversal attempts BEFORE resolving
    if (pathname.includes("..")) {
      res.writeHead(403);
      res.end("Forbidden: Path traversal not allowed");
      return;
    }

    const filePath = resolve(staticDir, pathname.slice(1) || "index.html");

    // Additional safety check after resolution
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
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
      res.end(content);
    } catch {
      if (pathname !== "/index.html") {
        try {
          const content = await readFile(resolve(staticDir, "index.html"));
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(content);
        } catch {
          res.writeHead(404);
          res.end("Not Found");
        }
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    }
  }

  broadcastRevision(sceneId: string, revision: number) {
    this.revision = revision;
    const clients = this.sseClients.get(sceneId) || [];
    for (const client of clients) {
      try {
        client.response.write(`id: ${revision}\n`);
        client.response.write(`data: ${JSON.stringify({ type: "revision", revision })}\n\n`);
      } catch {
        // Intentionally swallow SSE delivery errors
      }
    }
  }

  broadcastPatch(sceneId: string, patch: Patch) {
    const clients = this.sseClients.get(sceneId) || [];
    for (const client of clients) {
      try {
        client.response.write(`id: ${this.revision}\n`);
        client.response.write(`data: ${JSON.stringify({ type: "patch", patch })}\n\n`);
      } catch {
        // Intentionally swallow SSE delivery errors
      }
    }
  }

  start(): Promise<number> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.config.previewPort, "127.0.0.1", () => {
        const address = this.httpServer.address();
        const port = typeof address === "object" && address ? address.port : this.config.previewPort;
        this.config.previewPort = port;
        // trd 5: the Studio server writes .intent/runtime.json (port, pid, token)
        // so the agent can open the exact URL the SPA exchanges on. Best effort;
        // failure here must not take down the server.
        void this.writeRuntimeFile(port).catch(() => {});
        resolve(port);
      });
    });
  }

  private async writeRuntimeFile(port: number): Promise<void> {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const intentDir = resolve(this.config.projectRoot, ".intent");
    await mkdir(intentDir, { recursive: true });
    const runtime = { port, pid: process.pid, token: this.sessionToken, startedAt: new Date().toISOString() };
    await writeFile(resolve(intentDir, "runtime.json"), JSON.stringify(runtime, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        resolve();
      });
    });
  }
}

export function createServer(config: ServerConfig): IntentServer {
  return new IntentServer(config);
}

export function createServerFromConfig(projectRoot: string, config: Config): IntentServer {
  return new IntentServer({
    projectRoot,
    previewPort: config.previewPort,
    studioPort: config.studioPort,
    mcpPort: config.mcpPort,
  });
}

export { IntentError, ErrorCodes };