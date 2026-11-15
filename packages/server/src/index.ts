import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { resolve, dirname } from "node:path";
import {
  StoragePort,
  LockPort,
  CryptoPort,
} from "@intent/core";
import {
  Config,
  Patch,
} from "@intent/schema";
import { createFileStoragePort, createFileLockPort, createNodeCryptoPort } from "@intent/adapters-node";
import { previewScriptHashes } from "@intent/studio";
import { ApiContext } from "./api-helpers.js";
import {
  handleApiScene,
  handleApiPreview,
  handleApiPatchList,
  handleApiPatchCreate,
  handleApiPatchUpdate,
  handleApiPatchDelete,
  handleApiPatchSend,
  handleApiPatchResolve,
  handleMcp,
  handleApiInterviewGet,
  handleApiInterviewAnswer,
} from "./api-routes.js";
import { handleSSE, serveStatic, writeRuntimeFile } from "./runtime.js";
import { SseEventBus, type SSEClient } from "./event-bus.js";
export type { SSEClient } from "./event-bus.js";

export interface ServerConfig {
  projectRoot: string;
  previewPort: number;
  studioPort: number;
  mcpPort: number;
  /** Directory the SPA is served from. Defaults to the bundled packages/studio/public. */
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

export class IntentServer {
  /** Default SPA directory: INTENT_SPA_DIR override, else walk up from cwd to the workspace root. */
  private readonly defaultStaticDir = this.resolveDefaultSpaDir();

  /** import.meta is unusable here — some ESM loaders transpile this file to CJS. */
  private resolveDefaultSpaDir(): string {
    const fromEnv = process.env["INTENT_SPA_DIR"];
    if (fromEnv) return fromEnv;
    let dir = process.cwd();
    for (let i = 0; i < 8; i++) {
      const candidate = resolve(dir, "packages", "studio", "public");
      try {
        if (existsSync(resolve(candidate, "index.html"))) return candidate;
      } catch {
        // keep walking up
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return resolve(process.cwd(), "packages", "studio", "public");
  }

  private config: ServerConfig;
  private storage: StoragePort;
  private lockPort: LockPort;
  private crypto: CryptoPort;
  private sseClients: Map<string, SSEClient[]> = new Map();
  private httpServer: ReturnType<typeof createHttpServer>;
  private revision: number = 0;
  /** Event counter + ring + client fan-out (trd 11.4). */
  private readonly events = new SseEventBus(this.sseClients);
  private sessionToken: string;
  private sessionMaxAgeSeconds: number;
  /** Known live session ids -> createdAt (ms). */
  private sessions: Map<string, number> = new Map();
  private readonly apiCtx: ApiContext;

  constructor(config: ServerConfig) {
    this.config = config;
    this.storage = createFileStoragePort(config.projectRoot);
    this.lockPort = createFileLockPort(config.projectRoot);
    this.crypto = createNodeCryptoPort();
    this.httpServer = createHttpServer(this.handleRequest.bind(this));
    this.sessionToken =
      config.sessionToken ?? randomBytes(32).toString("hex");
    this.sessionMaxAgeSeconds = config.sessionMaxAgeSeconds ?? 1800;
    this.apiCtx = {
      storage: this.storage,
      lockPort: this.lockPort,
      crypto: this.crypto,
      projectRoot: config.projectRoot,
      broadcastPatchChanged: (sceneId, id, status) => this.broadcastPatchChanged(sceneId, id, status),
      broadcastRevision: (sceneId, revision) => this.broadcastRevision(sceneId, revision),
      broadcastInterviewChanged: (status) => this.broadcastInterviewChanged(status),
    };
  }

  private runtimeCtx() {
    return {
      storage: this.storage,
      sseClients: this.sseClients,
      getRevision: () => this.revision,
      setRevision: (revision: number) => {
        this.revision = revision;
      },
      staticDir: this.config.staticDir || this.defaultStaticDir,
      projectRoot: this.config.projectRoot,
      sessionToken: this.sessionToken,
      eventLog: this.events.eventLog,
      emitEvent: (type: string, payload: Record<string, unknown>) => this.events.emit(type, payload),
    };
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
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    // trd 11.1 shell CSP + sha256 sources for the two constant preview-runtime scripts
    // (about:srcdoc inherits this policy; hash sources cover the inline runtime)
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' " +
        previewScriptHashes().join(" ") +
        "; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
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
    if (pathname.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store");
    }

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

    // Session gate applies to /api only — the SPA shell and its assets are public
    // (trd 11.2: the token arrives via the URL fragment, so the shell must load
    // before any session exists; it carries no scene data or secrets).
    if (pathname.startsWith("/api/")) {
      if (!this.requireSession(req, res)) return;
    }

    if (pathname === "/api/protected") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // SSE endpoint (trd 11.3)
    if (pathname === "/api/events") {
      await handleSSE(this.runtimeCtx(), req, res, url);
      return;
    }

    // MCP endpoint (trd 11.3)
    if (pathname === "/api/mcp" && req.method === "POST") {
      await handleMcp(this.apiCtx, req, res);
      return;
    }

    // Full scene for the Studio shell (trd 11.3)
    if (pathname === "/api/scene" && req.method === "GET") {
      await handleApiScene(this.apiCtx, req, res, url);
      return;
    }

    // Preview srcdoc (trd 12.1; hash-pinned constant scripts)
    if (pathname === "/api/preview" && req.method === "GET") {
      await handleApiPreview(this.apiCtx, req, res, url);
      return;
    }

    // Feedback patch queue (trd 11.3 / design.md 4.8)
    if (pathname === "/api/patches" && req.method === "GET") {
      await handleApiPatchList(this.apiCtx, req, res, url);
      return;
    }
    if (pathname === "/api/patches" && req.method === "POST") {
      await handleApiPatchCreate(this.apiCtx, req, res);
      return;
    }
    if (pathname === "/api/patches/send" && req.method === "POST") {
      await handleApiPatchSend(this.apiCtx, req, res);
      return;
    }

    // Interview (trd 11.3)
    if (pathname === "/api/interview" && req.method === "GET") {
      await handleApiInterviewGet(this.apiCtx, req, res, url);
      return;
    }
    if (pathname === "/api/interview/answer" && req.method === "POST") {
      await handleApiInterviewAnswer(this.apiCtx, req, res);
      return;
    }
    const patchMatch = /^\/api\/patches\/([^/]+)(\/resolve)?$/.exec(pathname);
    const patchId = patchMatch?.[1] ?? '';
    const patchSuffix = patchMatch?.[2];
    if (patchMatch && req.method === "PATCH" && !patchSuffix) {
      await handleApiPatchUpdate(this.apiCtx, req, res, patchId);
      return;
    }
    if (patchMatch && req.method === "DELETE" && !patchSuffix) {
      await handleApiPatchDelete(this.apiCtx, req, res, patchId);
      return;
    }
    if (patchMatch && patchSuffix === "/resolve" && req.method === "POST") {
      await handleApiPatchResolve(this.apiCtx, req, res, patchId);
      return;
    }

    // Unknown /api routes: JSON 404, never the SPA HTML
    if (pathname.startsWith("/api/")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    // Static file serving
    await serveStatic(this.runtimeCtx(), req, res, pathname);
  }

  broadcastRevision(sceneId: string, revision: number) {
    this.revision = revision;
    this.events.send(sceneId, "revision", { revision });
  }

  broadcastPatch(sceneId: string, patch: Patch) {
    this.events.send(sceneId, "patch", { patch });
  }

  broadcastPatchChanged(sceneId: string, id: string, status: string) {
    this.events.send(sceneId, "patch.changed", { id, status, sceneId });
  }

  broadcastInterviewChanged(status: string) {
    // The interview is project-wide; fan out to every connected scene channel.
    this.events.sendAll("interview.changed", { status });
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
        void writeRuntimeFile({ projectRoot: this.config.projectRoot, sessionToken: this.sessionToken }, port).catch(() => {});
        resolve(port);
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      if (!this.httpServer.listening) {
        // Never started — nothing to close. (Static file server only if start() was called.)
        resolvePromise();
        return;
      }
      // closeAllConnections() force-closes keep-alive/SSE sockets so httpServer.close()
      // can finish (Node >= 18.2). Without it, an open SSE stream hangs shutdown forever.
      if (typeof (this.httpServer as { closeAllConnections?: () => void }).closeAllConnections === "function") {
        this.httpServer.closeAllConnections();
      }
      this.httpServer.close((err?: Error) => {
        if (err) reject(err);
        else resolvePromise();
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

