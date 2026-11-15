import {
  createMCPContext,
  handleMCPRequest,
  getMCPTool,
  MCP_TOOL_DESCRIPTORS,
} from "@intent/mcp-server";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "intent";
const SERVER_VERSION = "0.1.0";

// trd 10.1 envelope: every tool response is
//   { ok: true, data: T, warnings? } | { ok: false, error: { code, message, details?, hint? } }
// structuredContent and the text block both carry the same object;
// failures set the MCP isError flag.
type Envelope =
  | { ok: true; data: unknown; warnings?: unknown[] }
  | { ok: false; error: { code: string; message: string; details?: unknown; hint?: string } };

const okEnvelope = (data: unknown): Envelope => ({ ok: true, data });
const errEnvelope = (code: string, message: string, details?: unknown, hint?: string): Envelope => ({
  ok: false,
  error: { code, message, ...(details !== undefined ? { details } : {}), ...(hint !== undefined ? { hint } : {}) },
});

/** Human-readable lines for the structured tool failures this repo emits
 *  (apply_patch reports E_LOCKED / E_CONFLICT as { success: false, error, ... }). */
const STRUCTURED_FAILURE_MESSAGES: Record<string, string> = {
  E_LOCKED: "The object is locked by another writer.",
  E_CONFLICT: "The scene changed since the patch was drafted (baseRevision mismatch).",
};

/** A tool returning { success: false, error: <code> } is a failed operation —
 *  map it to the error envelope instead of leaking it as if it were data. */
function structuredFailureOf(result: unknown): { code: string; details: Record<string, unknown> } | null {
  if (typeof result !== "object" || result === null) return null;
  const r = result as Record<string, unknown>;
  if (r["success"] === false && typeof r["error"] === "string") {
    const details = { ...r };
    delete details["success"];
    const code = details["error"] as string;
    delete details["error"];
    return { code, details };
  }
  return null;
}

interface JsonRpcMessage {
  jsonrpc?: unknown;
  id?: number | string | null;
  method?: unknown;
  params?: unknown;
}

/**
 * `intent mcp` — the MCP stdio transport (trd 14.3). Intended to be launched by
 * an agent, not by a human. stdout carries ONLY protocol messages
 * (newline-delimited JSON-RPC 2.0); diagnostics have nowhere else to go anyway.
 */
export async function runMcpStdio(projectRoot: string): Promise<void> {
  const write = (obj: unknown) => {
    process.stdout.write(JSON.stringify(obj) + "\n");
  };
  const reply = (id: number | string | null, result: unknown) =>
    write({ jsonrpc: "2.0", id, result });
  const fail = (id: number | string | null, code: number, message: string, data?: unknown) =>
    write({ jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } });

  const context = createMCPContext(projectRoot);

  const handleMessage = async (msg: unknown): Promise<void> => {
    if (typeof msg !== "object" || msg === null || Array.isArray(msg)) {
      fail(null, -32600, "Invalid Request: not an object");
      return;
    }
    const m = msg as JsonRpcMessage;
    if (m.jsonrpc !== "2.0") {
      fail(typeof m.id === "number" || typeof m.id === "string" ? m.id : null, -32600, 'Invalid Request: jsonrpc must be "2.0"');
      return;
    }
    const method = m.method;
    if (typeof method !== "string" || method.length === 0) {
      fail(typeof m.id === "number" || typeof m.id === "string" ? m.id : null, -32600, "Invalid Request: missing method");
      return;
    }
    const isNotification = m.id === undefined || m.id === null;

    const sendError = (code: number, message: string, data?: unknown) => {
      // Notifications never get a response; nothing else swallows errors silently.
      if (isNotification) return;
      fail(m.id as number | string, code, message, data);
    };

    try {
      switch (method) {
        case "initialize":
          reply(m.id ?? null, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: {} },
            serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          });
          return;
        case "ping":
          reply(m.id ?? null, {});
          return;
        case "tools/list":
          reply(m.id ?? null, { tools: MCP_TOOL_DESCRIPTORS });
          return;
        case "tools/call": {
          const params = (m.params ?? {}) as { name?: unknown; arguments?: unknown };
          const name = params.name;
          if (typeof name !== "string" || name.length === 0) {
            sendError(-32602, 'Invalid params: "name" (string) is required');
            return;
          }
          if (!getMCPTool(name)) {
            sendError(-32602, `Unknown tool: ${name}`);
            return;
          }
          const sendEnvelope = (id: number | string | null, envelope: Envelope, isError: boolean) => {
            const body = JSON.stringify(envelope);
            reply(id, {
              content: [{ type: "text", text: body }],
              structuredContent: envelope,
              ...(isError ? { isError: true } : {}),
            });
          };
          try {
            const result = await handleMCPRequest(name, params.arguments ?? {}, context);
            const structured = structuredFailureOf(result);
            if (structured) {
              sendEnvelope(
                m.id ?? null,
                errEnvelope(
                  structured.code,
                  STRUCTURED_FAILURE_MESSAGES[structured.code] ?? `Tool failed: ${structured.code}`,
                  structured.details,
                ),
                true,
              );
            } else {
              sendEnvelope(m.id ?? null, okEnvelope(result), false);
            }
          } catch (err) {
            const e = err as { code?: unknown; message?: unknown; details?: unknown };
            const code = typeof e?.code === "string" ? e.code : "E_INTERNAL";
            const message = typeof e?.message === "string" ? e.message : String(err);
            // trd 10.1 + trd 18.2: the issue path travels in details.
            sendEnvelope(m.id ?? null, errEnvelope(code, message, e?.details), true);
          }
          return;
        }
        default:
          // MCP notifications (e.g. notifications/initialized) get no response.
          if (method.startsWith("notifications/")) return;
          sendError(-32601, `Method not found: ${method}`);
          return;
      }
    } catch (err) {
      sendError(-32603, "Internal error", { message: err instanceof Error ? err.message : String(err) });
    }
  };

  await new Promise<void>((done) => {
    let buffer = "";
    // Hard cap on a single JSON-RPC line (trd caps responses at 200 KB; agent
    // requests get no looser bound). A line beyond the cap is dropped and
    // reported — it can never reach zod as an oversized collection.
    const MAX_LINE = 1024 * 1024;
    // Serialize message handling so responses are written in request order
    // (JSON-RPC ids match, but ordered output keeps clients simple).
    let pending: Promise<void> = Promise.resolve();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      buffer += chunk;
      let idx = buffer.indexOf("\n");
      while (idx !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        idx = buffer.indexOf("\n");
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (line.length > MAX_LINE) {
          fail(null, -32600, "Invalid Request: line exceeds 1 MiB");
          continue;
        }
        let msg: unknown;
        try {
          msg = JSON.parse(trimmed);
        } catch {
          fail(null, -32700, "Parse error");
          continue;
        }
        pending = pending.then(() => handleMessage(msg)).catch(() => {
          fail(null, -32603, "Internal error while handling message");
        });
      }
      if (buffer.length > MAX_LINE) {
        fail(null, -32600, "Invalid Request: line exceeds 1 MiB");
        buffer = "";
      }
    });
    process.stdin.on("end", () => { void pending.then(done); });
    process.stdin.on("error", () => { void pending.then(done); });
  });
}
