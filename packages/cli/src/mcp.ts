import {
  createMCPContext,
  handleMCPRequest,
  getMCPTool,
  MCP_TOOL_DESCRIPTORS,
} from "@intent/mcp-server";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "intent";
const SERVER_VERSION = "0.1.0";

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
          try {
            const result = await handleMCPRequest(name, params.arguments ?? {}, context);
            // trd 10.1: the JSON body is the response; agents that only show text see it there.
            reply(m.id ?? null, { content: [{ type: "text", text: JSON.stringify(result) }] });
          } catch (err) {
            const e = err as { code?: unknown; message?: unknown; details?: unknown; issues?: unknown };
            const code = typeof e?.code === "string" ? e.code : "E_INTERNAL";
            const message = typeof e?.message === "string" ? e.message : String(err);
            const data = { code, ...(e?.issues !== undefined ? { details: e.issues } : e?.details !== undefined ? { details: e.details } : {}) };
            // trd 10.1: failures set the MCP isError flag as well.
            reply(m.id ?? null, {
              content: [{ type: "text", text: JSON.stringify({ error: { code, message }, ...(data.details !== undefined ? { details: data.details } : {}) }) }],
              isError: true,
            });
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
    });
    process.stdin.on("end", () => { void pending.then(done); });
    process.stdin.on("error", () => { void pending.then(done); });
  });
}
