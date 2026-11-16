import { IncomingMessage, ServerResponse } from "node:http";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { StoragePort, LockPort, CryptoPort, IntentError, ErrorCodes, writeAtomic } from "@intent/core";
import { Feedback, Scene } from "@intent/schema";

/** Dependencies the /api handlers (including /api/mcp) need. */
export interface ApiContext {
  storage: StoragePort;
  lockPort: LockPort;
  crypto: CryptoPort;
  projectRoot: string;
  broadcastPatchChanged: (sceneId: string, id: string, status: string) => void;
  broadcastRevision: (sceneId: string, revision: number) => void;
  broadcastInterviewChanged: (status: string) => void;
}

/** New p_-prefixed Crockford id for feedback queue items. */
export function newPatchId(): string {
  const crockf = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(26);
  let out = "";
  for (let i = 0; i < 26; i++) {
    out += crockf[(bytes[i] as number) % 32];
  }
  return `p_${out}`;
}

/** Same entropy source as newPatchId; annotation ids use the a_ prefix (trd 9.7). */
export function newAnnotationId(): string {
  const crockf = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(26);
  let out = "";
  for (let i = 0; i < 26; i++) {
    out += crockf[(bytes[i] as number) % 32];
  }
  return `a_${out}`;
}

/** Locked objects including descendants of locked containers (effective lock set). */
export function lockedWithDescendants(scene: Scene | null, locked: string[]): string[] {
  const out = new Set(locked);
  if (!scene) return [...out];
  for (const root of locked) {
    const stack = [...(scene.objects[root]?.children ?? [])];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (out.has(id)) continue;
      out.add(id);
      stack.push(...(scene.objects[id]?.children ?? []));
    }
  }
  return [...out];
}

export function sendJson(res: ServerResponse, status: number, body: unknown, extraHeaders: Record<string, string> = {}): void {
  res.writeHead(status, { "Content-Type": "application/json", ...extraHeaders });
  res.end(JSON.stringify(body));
}

/** trd 18.2: zod-like failures surface as E_SCHEMA with the issue path. */
export function sendSchemaError(res: ServerResponse, err: unknown): void {
  const issues = (err as { issues?: { path?: (string | number)[]; message?: string }[] }).issues;
  const first = Array.isArray(issues) ? issues[0] : undefined;
  const where = first?.path?.length ? ` at ${first.path.join(".")}` : "";
  sendJson(res, 400, {
    error: { code: "E_SCHEMA", message: `Invalid input${where}: ${first?.message ?? "schema validation failed"}` },
  });
}

/** Read a JSON body; throws { code: "E_LIMIT" } when the byte cap is exceeded. */
export async function readJsonBody(req: IncomingMessage, limit: number): Promise<unknown> {
  let size = 0;
  let body = "";
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) {
      // Drain the remainder so a keep-alive client is not confused by an
      // unread request on the wire.
      req.resume();
      throw Object.assign(new Error("request body too large"), { code: "E_LIMIT" });
    }
    body += (chunk as Buffer).toString("utf-8");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error("request body is not valid JSON"), { code: "E_BAD_REQUEST" });
  }
}

/** Read a raw body (e.g. image/png) into a Buffer; throws { code: "E_LIMIT" } over the cap. */
export async function readRawBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > limit) {
      req.resume();
      throw Object.assign(new Error("request body too large"), { code: "E_LIMIT" });
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

/** Maps a readJsonBody failure to the right status/envelope (413 vs 400). */
export function sendBodyError(res: ServerResponse, err: unknown): void {
  const code = (err as { code?: unknown })?.code;
  if (code === "E_LIMIT") {
    sendJson(res, 413, { error: { code: "E_LIMIT", message: "Payload too large" } });
    return;
  }
  sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "Request body is not valid JSON" } });
}

export async function readQueue(storage: StoragePort, sceneId: string): Promise<Feedback[]> {
  return storage.readFeedback(sceneId);
}

/** trd 9.6: snapshot the scene before a before-send version transition. Best effort. */
export async function saveBeforeSendVersion(storage: StoragePort, projectRoot: string, sceneId: string): Promise<void> {
  try {
    const scene = await storage.readScene(sceneId);
    if (!scene) return;
    const versionsDir = resolve(projectRoot, ".intent", "versions");
    await mkdir(versionsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = resolve(versionsDir, `${stamp}-r${scene.revision}-before-send.json`);
    await writeAtomic(file, JSON.stringify(scene, null, 0));
  } catch {
    // Best effort — a missing snapshot must not block sending
  }
}

/** Design.md 4.3 quick-feedback chip → human label (used when a draft has no text). */
export const CHIP_LABELS: Record<string, string> = {
  bigger: "Bigger",
  smaller: "Smaller",
  "more-space": "More space",
  "less-clutter": "Less clutter",
  "different-color": "Different color",
  "more-premium": "More premium",
  simpler: "Simpler",
};

export { IntentError, ErrorCodes };
