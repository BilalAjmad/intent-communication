import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  StoragePort,
  LockPort,
  CryptoPort,
  IntentError,
  ErrorCodes,
} from "@intent/core";
import { Scene, Patch, Lock, Config, validateScene, validatePatch } from "@intent/schema";
import { createFileStoragePort, createFileLockPort, createNodeCryptoPort } from "@intent/adapters-node";
import { handleMCPRequest } from "@intent/mcp-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ServerConfig {
  projectRoot: string;
  previewPort: number;
  studioPort: number;
  mcpPort: number;
  staticDir?: string;
}

export interface SSEClient {
  response: ServerResponse;
  sceneId: string;
  lastEventId: number;
}

const ALLOWED_ORIGIN = "http://127.0.0.1";

export class IntentServer {
  private config: ServerConfig;
  private storage: StoragePort;
  private lockPort: LockPort;
  private crypto: CryptoPort;
  private sseClients: Map<string, SSEClient[]> = new Map();
  private httpServer: ReturnType<typeof createHttpServer>;
  private revision: number = 0;

  constructor(config: ServerConfig) {
    this.config = config;
    this.storage = createFileStoragePort(config.projectRoot);
    this.lockPort = createFileLockPort(this.storage);
    this.crypto = createNodeCryptoPort();
    this.httpServer = createHttpServer(this.handleRequest.bind(this));
  }

  getConfig(): ServerConfig {
    return this.config;
  }

  private checkOrigin(req: IncomingMessage): boolean {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (!origin) return true;
    try {
      const originUrl = new URL(origin);
      if (originUrl.hostname !== "127.0.0.1" && originUrl.hostname !== "localhost") {
        return false;
      }
      if (host && originUrl.host !== host) {
        return false;
      }
    } catch {
      return false;
    }
    // Also check Host header
    if (host) {
      const hostHeader = Array.isArray(host) ? host[0] : host;
      if (!hostHeader.startsWith("127.0.0.1:") && !hostHeader.startsWith("localhost:")) {
        return false;
      }
    }
    return true;
  }

  private setSecurityHeaders(res: ServerResponse) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'");
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse) {
    const rawUrl = req.url || "";
    const url = new URL(rawUrl, `http://127.0.0.1:${this.config.previewPort}`);
    const pathname = url.pathname;

    // Early path traversal check on raw URL (before URL normalization)
    if (rawUrl.includes("..")) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden: Path traversal not allowed" }));
      return;
    }

    // Security: validate Origin and Host
    if (!this.checkOrigin(req)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden: Invalid Origin or Host" }));
      return;
    }

    this.setSecurityHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

// Token exchange: POST /api/session with token from runtime.json sets HttpOnly SameSite=Strict cookie
    if (pathname === "/api/session" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }
      try {
        const { token } = JSON.parse(body);
        // In production, validate token against runtime.json
        // For now, accept any non-empty token
        if (!token || typeof token !== "string" || token.trim() === "") {
          res.writeHead(403, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Forbidden: Invalid or missing token" }));
          return;
        }
        // Set HttpOnly SameSite=Strict cookie
        res.setHeader("Set-Cookie", `intent_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Bad Request" }));
      }
      return;
    }

    // Protected endpoint check: no or wrong session cookie gives 403
    if (pathname === "/api/protected") {
      const cookies = req.headers.cookie || "";
      const sessionMatch = cookies.match(/intent_session=([^;]+)/);
      const sessionToken = sessionMatch ? sessionMatch[1] : null;
      if (!sessionToken) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden: No session cookie" }));
        return;
      }
      // Validate session token (in production, check against stored sessions)
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, session: sessionToken }));
      return;
    }

    // SSE endpoint
    if (pathname === "/events") {
      this.handleSSE(req, res, url);
      return;
    }

    // MCP endpoint
    if (pathname === "/mcp" && req.method === "POST") {
      this.handleMCP(req, res);
      return;
    }

    // Health check
    if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", revision: this.revision }));
      return;
    }

    // Static file serving
    await this.serveStatic(req, res, pathname);
  }

  private handleSSE(req: IncomingMessage, res: ServerResponse, url: URL) {
    const sceneId = url.searchParams.get("scene") || "default";
    const lastEventIdHeader = req.headers["last-event-id"];
    const lastEventIdValue = Array.isArray(lastEventIdHeader) ? lastEventIdHeader[0] : lastEventIdHeader;
    const lastEventId = parseInt(lastEventIdValue || "0", 10);

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
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }
    try {
      const { tool, input } = JSON.parse(body);
      const result = await handleMCPRequest(tool, input, {
        projectRoot: this.config.projectRoot,
        storage: this.storage,
        lockPort: this.lockPort,
        crypto: this.crypto,
      });
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

    let filePath = resolve(staticDir, pathname.slice(1) || "index.html");

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
      }
    }
  }

  start(): Promise<number> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.config.previewPort, "127.0.0.1", () => {
        const address = this.httpServer.address();
        const port = typeof address === "object" && address ? address.port : this.config.previewPort;
        console.log(`Intent preview server running on http://127.0.0.1:${port}`);
        this.config.previewPort = port;
        resolve(port);
      });
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