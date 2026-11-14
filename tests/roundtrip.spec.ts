import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve } from "node:path";
import { exportToHtml } from "../packages/engine/dist/index.js";
import { createServer } from "../packages/server/dist/index.js";
import { createFileStoragePort } from "../packages/adapters-node/dist/index.js";

// AC-M1-09 — full Studio roundtrip driven in a real browser + real server.
//
// HONEST SCOPE NOTES (2026-11-14, read docs/review.md §21 first):
//   * This repo has NO Studio web UI. Selection (INTENT_CLICK postMessage), the
//     preview document and the server auth/SSE/MCP paths all exist and are real.
//     The feedback "Send" button, the draft/sent/applied tray, and any visible
//     "applied" status element DO NOT EXIST. This test exercises the real
//     production paths in place of them:
//       select object      → real browser click, real INTENT_CLICK message
//       write feedback     → real StoragePort.writeFeedback (the only write path)
//       send               → get_feedback via /mcp (message visible through the real tool)
//       apply patch        → real /mcp apply_patch through the same handler the Studio uses
//       SSE updates        → real EventSource in the browser receives revision 2
//       status applied     → real storage write (applied + appliedAt + patchId),
//                            read back through /mcp get_feedback
//   * Feedback statuses in this codebase are sent/acknowledged/applied/rejected/deferred —
//     there is NO "draft" feedback status (the design doc's "draft" refers to patch status).
//   * trd 11.2 ships the session cookie with Path=/api. Browsers will not attach that
//     cookie to /events or /mcp, so a same-origin Studio app CANNOT consume SSE/MCP with
//     the production cookie today. The test injects its own intent_session cookie scoped
//     to "/" (test mechanics, visible in the test). Relaxing Path or proxying is a design
//     decision the user must make — not changed here (no new features allowed).
//   * buildPreviewDocument's inline script fires INTENT_CLICK on object click — but the
//     SANDBOXED preview/export CSP (default-src 'none') blocks EventSource by design.
//     The real Studio shell (still unimplemented) must be served with connect-src 'self'
//     — the server's HTTP headers already allow it. The test therefore serves at "/" the
//     real EXPORT document with exactly two labelled fixture edits (asserted to apply):
//       1. its meta CSP gains `connect-src 'self'` — the minimal connectivity a Studio
//          shell needs (the export artifact keeps default-src 'none' elsewhere);
//       2. a trailing <script> opens the REAL /events SSE stream and records events.
//     Everything else — markup, click protocol, auth, SSE, /mcp handler — is production code.

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const TEXT = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BUTTON = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";
const PATCH_ID = "p_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const FEEDBACK_ID = "f_01ARZ3NDEKTSV4RRFFQ69G5FAV";

function makeScene() {
  return {
    version: 1,
    revision: 1,
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    screens: {
      [SCREEN]: {
        id: SCREEN,
        type: "screen",
        parentId: null,
        children: [TEXT, BUTTON],
        props: { title: "Roundtrip", width: 390, height: 844 },
        style: {},
        meta: {},
      },
    },
    objects: {
      [TEXT]: {
        id: TEXT,
        type: "text",
        parentId: SCREEN,
        children: [],
        props: { content: "Hello Roundtrip", fontSize: 20 },
        style: {},
        meta: {},
      },
      [BUTTON]: {
        id: BUTTON,
        type: "button",
        parentId: SCREEN,
        children: [],
        props: { label: "Confirm Booking", variant: "primary" },
        style: {},
        meta: {},
      },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Roundtrip", tags: [] },
  };
}

let tmpDir: string;
let server: ReturnType<typeof createServer>;
let port: number;
let sessionCookie: string;

const base = () => `http://127.0.0.1:${port}`;
const mcpHeaders = () => ({
  "Content-Type": "application/json",
  Origin: `http://127.0.0.1:${port}`,
  Cookie: `intent_session=${sessionCookie}`,
});

test.beforeAll(async () => {
  const scene = makeScene();
  tmpDir = resolve(os.tmpdir(), `.test-roundtrip-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(resolve(tmpDir, ".intent", "scenes"), { recursive: true });
  await fs.mkdir(resolve(tmpDir, ".intent", "locks"), { recursive: true });
  await fs.writeFile(resolve(tmpDir, ".intent", "scenes", `${SCREEN}.json`), JSON.stringify(scene), "utf-8");
  // The server serves .intent/studio/index.html at "/". Seed it as the real export document
  // plus the two labelled fixture edits described in the header (CSP connect-src + SSE glue).
  await fs.mkdir(resolve(tmpDir, ".intent", "studio"), { recursive: true });
  let studioHtml = exportToHtml(scene as any);
  const cspBefore = "default-src &#039;none&#039;; style-src &#039;unsafe-inline&#039;; script-src &#039;unsafe-inline&#039;; img-src data:; base-uri &#039;none&#039;; form-action &#039;none&#039;";
  const cspAfter = "default-src &#039;self&#039;; style-src &#039;unsafe-inline&#039;; script-src &#039;unsafe-inline&#039;; img-src data:; connect-src &#039;self&#039;; base-uri &#039;none&#039;; form-action &#039;none&#039;";
  if (!studioHtml.includes(cspBefore)) throw new Error("export CSP meta not found — fixture build is stale");
  studioHtml = studioHtml.replace(cspBefore, cspAfter);
  const glue = `<script>(function(){var w=window;w.__sseEvents=[];var es=new EventSource('/events?scene=${SCREEN}');es.onmessage=function(e){try{w.__sseEvents.push(JSON.parse(e.data));}catch(_){}}})();</script></body>`;
  if (!studioHtml.includes("</body>")) throw new Error("export has no </body> — fixture build is stale");
  studioHtml = studioHtml.replace("</body>", glue);
  await fs.writeFile(resolve(tmpDir, ".intent", "studio", "index.html"), studioHtml, "utf-8");

  server = createServer({ projectRoot: tmpDir, previewPort: 0, studioPort: 0, mcpPort: 0 });
  port = await server.start();

  const exchange = await fetch(`${base()}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base() },
    body: JSON.stringify({ token: server.getSessionToken() }),
  });
  expect(exchange.status).toBe(204);
  sessionCookie = (exchange.headers.get("Set-Cookie") ?? "").split(";")[0].replace("intent_session=", "");
  expect(sessionCookie.length).toBeGreaterThan(10);
});

test.afterAll(async () => {
  if (server) await server.stop();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

test("select → feedback → send → MCP apply_patch → SSE revision → feedback marked applied", async ({ page, context }) => {
  // Test-only cookie scoped to the server root so the browser can consume /events and call /mcp.
  // (Production Path=/api — see header notes.)
  await context.addCookies([{ name: "intent_session", value: sessionCookie, url: `${base()}/` }]);

  await page.addInitScript(() => {
    const w = window as unknown as {
      __intentClicks: string[];
      __sseEvents: unknown[];
    };
    w.__intentClicks = [];
    w.__sseEvents = [];
    window.addEventListener("message", (e: MessageEvent) => {
      const data = e.data as { type?: string; objectId?: string };
      if (data && data.type === "INTENT_CLICK" && typeof data.objectId === "string") {
        w.__intentClicks.push(data.objectId);
      }
    });
  });

  // 1. Render the REAL Studio preview document served by the REAL server
  await page.goto(`${base()}/`);
  await expect(page.locator(".intent-screen")).toBeVisible();

  // 2. Select the text object (real click → INTENT_CLICK postMessage)
  await page.click(`[data-object-id="${TEXT}"]`);
  await page.waitForFunction(
    (id) => (window as unknown as { __intentClicks: string[] }).__intentClicks.includes(id),
    TEXT,
    { timeout: 5000 },
  );

  // 3. The served shell opened /events on load (real SSE via the fixture glue above).
  //    The browser must receive the initial revision: 1 event.
  await page.waitForFunction(
    () =>
      (window as unknown as { __sseEvents: Array<{ type: string; revision: number }> }).__sseEvents.some(
        (e) => e.type === "revision" && e.revision === 1,
      ),
    { timeout: 5000 },
  );

  // 4. Write feedback (the production write path — there is no feedback endpoint)
  const storage = createFileStoragePort(tmpDir);
  await storage.writeFeedback(SCREEN, [
    {
      id: FEEDBACK_ID,
      sceneId: SCREEN,
      objectId: TEXT,
      kind: "visual",
      message: "Heading text is too long for this screen",
      severity: "medium",
      status: "sent",
      createdAt: new Date().toISOString(),
      acknowledgedAt: null,
      appliedAt: null,
      patchId: null,
    },
  ]);

  // 5. "Send" is visible through the real get_feedback tool (status sent)
  const sentRes = await fetch(`${base()}/mcp`, {
    method: "POST",
    headers: mcpHeaders(),
    body: JSON.stringify({ tool: "get_feedback", input: { sceneId: SCREEN } }),
  });
  expect(sentRes.status).toBe(200);
  const sentBody = (await sentRes.json()) as { result?: { feedback?: Array<{ id: string; message: string; status: string }> } };
  expect(sentBody.result?.feedback?.length).toBe(1);
  expect(sentBody.result?.feedback?.[0].message).toContain("too long");
  expect(sentBody.result?.feedback?.[0].status).toBe("sent");

  // 6. Apply a patch through the REAL /mcp apply_patch path (the Studio's path)
  const patchRes = await fetch(`${base()}/mcp`, {
    method: "POST",
    headers: mcpHeaders(),
    body: JSON.stringify({
      tool: "apply_patch",
      input: {
        patch: {
          id: PATCH_ID,
          sceneId: SCREEN,
          baseRevision: 1,
          objectId: TEXT,
          op: "set",
          path: "props.content",
          value: "Short",
          createdAt: new Date().toISOString(),
          status: "pending",
        },
      },
    }),
  });
  const patchText = await patchRes.text();
  const patchBody = JSON.parse(patchText) as { success: boolean; result?: { success?: boolean; revision?: number } };
  expect(patchRes.status).toBe(200);
  expect(patchBody.success).toBe(true);
  expect(patchBody.result?.success).toBe(true);
  expect(patchBody.result?.revision).toBe(2);

  // 7. SSE: the browser received revision 2 (real-time update path)
  await page.waitForFunction(
    () =>
      (window as unknown as { __sseEvents: Array<{ type: string; revision: number }> }).__sseEvents.some(
        (e) => e.type === "revision" && e.revision === 2,
      ),
    { timeout: 5000 },
  );

  // 8. Mark feedback applied (the production write path — no automation does this yet)
  const feedback = await storage.readFeedback(SCREEN);
  const target = feedback.find((f) => f.id === FEEDBACK_ID);
  expect(target).toBeDefined();
  await storage.writeFeedback(SCREEN, [
    { ...target!, status: "applied", appliedAt: new Date().toISOString(), patchId: PATCH_ID },
  ]);

  // 9. Status "applied" is readable through the real get_feedback tool
  const appliedRes = await fetch(`${base()}/mcp`, {
    method: "POST",
    headers: mcpHeaders(),
    body: JSON.stringify({ tool: "get_feedback", input: { sceneId: SCREEN } }),
  });
  const appliedBody = (await appliedRes.json()) as {
    result?: { feedback?: Array<{ id: string; status: string; patchId: string | null }> };
  };
  const applied = appliedBody.result?.feedback?.find((f) => f.id === FEEDBACK_ID);
  expect(applied).toBeDefined();
  expect(applied!.status).toBe("applied");
  expect(applied!.patchId).toBe(PATCH_ID);
});
