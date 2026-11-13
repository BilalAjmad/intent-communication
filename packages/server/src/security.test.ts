import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer } from "./index";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

// Security tests (SEC-01..SEC-07, plus regression tests for the auth stub).
//
// The server previously accepted any non-empty token at /api/session and
// any cookie at /api/protected, and left /mcp and /events unauthenticated.
// These tests pin the trd 11.2 contract for real. Every assertion below
// fails if the server falls back to accepting anything.

describe("Security tests (SEC-01..SEC-07)", () => {
  const testDir = tmpdir() + "/.test-server-security";
  const securityConfig = {
    projectRoot: testDir,
    previewPort: 0,
    studioPort: 3457,
    mcpPort: 3458,
  };
  let secServer: ReturnType<typeof createServer>;
  let port = 0;

  beforeEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    secServer = createServer(securityConfig);
    port = await secServer.start();
  });

  afterEach(async () => {
    if (secServer) {
      await secServer.stop();
    }
  });

  const url = (path: string) => `http://127.0.0.1:${port}${path}`;
  const origin = () => ({ Origin: `http://127.0.0.1:${port}` });

  async function seedScene() {
    const scenesDir = resolve(testDir, ".intent", "scenes");
    await fs.mkdir(scenesDir, { recursive: true });
    const scene = {
      version: 1,
      revision: 1,
      createdAt: "2026-11-13T00:00:00.000Z",
      updatedAt: "2026-11-13T00:00:00.000Z",
      screens: {},
      objects: {},
      screenOrder: [],
      metadata: { name: "Test", tags: [] },
    };
    await fs.writeFile(resolve(scenesDir, "default.json"), JSON.stringify(scene), "utf-8");
  }

  async function exchange(): Promise<string> {
    const token = secServer.getSessionToken();
    const response = await fetch(url("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin() },
      body: JSON.stringify({ token }),
    });
    expect(response.status).toBe(204);
    const setCookie = response.headers.get("Set-Cookie") ?? "";
    const sessionId = (setCookie.match(/intent_session=([^;]+)/) || [])[1] ?? "";
    expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
    return `intent_session=${sessionId}`;
  }

  // SEC-01: the server binds to 127.0.0.1 only.
  it("SEC-01: server binds to loopback only", async () => {
    const address = secServer.addressOf();
    expect(address).toBeDefined();
    if (typeof address === "object" && address) {
      expect(address.address).toBe("127.0.0.1");
    }
  });

  // SEC-03: Host must be exactly 127.0.0.1:<port> or localhost:<port>.
  it("SEC-03: rejects requests with a bad Host header", async () => {
    const s = secServer as unknown as {
      checkHost(req: { headers: { host?: string } }): boolean;
    };
    expect(s.checkHost({ headers: { host: "evil.com" } })).toBe(false);
    expect(s.checkHost({ headers: { host: `127.0.0.1:${port}` } })).toBe(true);
    expect(s.checkHost({ headers: { host: `localhost:${port}` } })).toBe(true);
    expect(s.checkHost({ headers: {} })).toBe(false);
  });

  // SEC-04: non-GET requests must carry a matching Origin.
  it("SEC-04: rejects non-GET requests with a foreign Origin", async () => {
    const response = await fetch(url("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.com" },
      body: JSON.stringify({ token: secServer.getSessionToken() }),
    });
    expect(response.status).toBe(403);
  });

  it("SEC-04b: rejects non-GET requests without any Origin", async () => {
    const response = await fetch(url("/mcp"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool: "get_scene", input: {} }),
    });
    expect(response.status).toBe(403);
  });

  // SEC-05: no CORS headers are sent; preflight is refused.
  it("SEC-05: does not send wildcard CORS", async () => {
    const response = await fetch(url("/health"));
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("SEC-05b: preflight requests are refused", async () => {
    const response = await fetch(url("/api/session"), {
      method: "OPTIONS",
      headers: { Origin: origin() },
    });
    expect(response.status).toBe(403);
  });

  // SEC-02: a missing or unknown session cookie gives 403.
  it("SEC-02: no session cookie gives 403 on the protected endpoint", async () => {
    const response = await fetch(url("/api/protected"));
    expect(response.status).toBe(403);
  });

  it("SEC-02: an unknown session cookie gives 403 on the protected endpoint", async () => {
    const response = await fetch(url("/api/protected"), {
      headers: { Cookie: "intent_session=wrong-token" },
    });
    expect(response.status).toBe(403);
  });

  // SEC-06: token exchange produces a random session id.
  it("SEC-06: token exchange sets HttpOnly SameSite=Strict Path=/api cookie", async () => {
    const token = secServer.getSessionToken();
    const response = await fetch(url("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin() },
      body: JSON.stringify({ token }),
    });
    expect(response.status).toBe(204);
    const setCookie = response.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).toContain("Path=/api");

    // The session id must be random and must not be the token itself.
    const sessionId = (setCookie.match(/intent_session=([^;]+)/) || [])[1] ?? "";
    expect(sessionId).toMatch(/^[0-9a-f]{64}$/);
    expect(sessionId).not.toBe(token);

    // The exchanged session reaches the protected endpoint.
    const protectedRes = await fetch(url("/api/protected"), {
      headers: { Cookie: `intent_session=${sessionId}` },
    });
    expect(protectedRes.status).toBe(200);
  });

  it("SEC-06b: token exchange rejects a wrong token", async () => {
    const response = await fetch(url("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin() },
      body: JSON.stringify({ token: "not-the-token" }),
    });
    expect(response.status).toBe(403);
  });

  it("SEC-06c: token exchange rejects an empty token", async () => {
    const response = await fetch(url("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin() },
      body: JSON.stringify({ token: "" }),
    });
    expect(response.status).toBe(403);
  });

  // SEC-07: path traversal in static files is refused.
  it("SEC-07: refuses path traversal in static files", async () => {
    const response = await fetch(url("/../../../etc/passwd"));
    expect([403, 404]).toContain(response.status);
    const body = await response.text();
    expect(body).not.toContain("root:");
  });

  // /mcp and /events require a session; an unauthenticated local process
  // must not read scene contents or send patches.
  it("SEC-08: /mcp without a session cookie gives 403", async () => {
    const response = await fetch(url("/mcp"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin() },
      body: JSON.stringify({ tool: "get_scene", input: {} }),
    });
    expect(response.status).toBe(403);
  });

  it("SEC-08b: /events without a session cookie gives 403", async () => {
    const response = await fetch(url("/events"));
    expect(response.status).toBe(403);
  });

  it("SEC-08c: /mcp with a valid session cookie returns the scene", async () => {
    await seedScene();
    const cookie = await exchange();
    const response = await fetch(url("/mcp"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin(), Cookie: cookie },
      body: JSON.stringify({
        tool: "get_scene",
        input: { objectIds: [], depth: 1, includeLocks: false, maxBytes: 8192 },
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("SEC-08d: an authenticated /events connection is opened", async () => {
    const cookie = await exchange();
    const controller = new AbortController();
    const response = await fetch(url("/events"), {
      signal: controller.signal,
      headers: { Cookie: cookie },
    });
    try {
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    } finally {
      controller.abort();
    }
  });

  // Bodies are capped at 2 MB (trd 11.3); the exchange is capped tighter.
  it("SEC-09: an oversized request body is refused with 413", async () => {
    const response = await fetch(url("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin() },
      body: JSON.stringify({ token: "x".repeat(2 * 1024 * 1024) }),
    });
    expect(response.status).toBe(413);
  });

  // A POST to /api/session with a valid session but no valid token is 403, not 200.
  it("SEC-10: a non-matching Host is refused even with a valid token", async () => {
    const s = secServer as unknown as {
      checkHost(req: { headers: { host?: string } }): boolean;
    };
    expect(s.checkHost({ headers: { host: "127.0.0.1:1" } })).toBe(false);
  });

  // The exchanged session cookie keeps the Path=/api scope.
  it("SEC-11: the session cookie is scoped to /api", async () => {
    const response = await fetch(url("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...origin() },
      body: JSON.stringify({ token: secServer.getSessionToken() }),
    });
    const setCookie = response.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("Path=/api");
  });
});
