import { withProjectLock } from "@intent/core";
import { IncomingMessage, ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { validateScene } from "@intent/schema";
import {
  ApiContext,
  sendJson,
  saveBeforeSendVersion,
} from "./api-helpers.js";

/**
 * Named-versions surface (trd 6.x / design.md 4.x). `saveBeforeSendVersion`
 * snapshots the scene before every send; this module lets the Studio list and
 * restore those snapshots. Restore keeps history: it bumps revision by one
 * (restore is itself an edit) and stamps updatedAt.
 */
const VERSION_FILE = /^([0-9A-Za-z_\-:.]+)Z-r(\d+)(?:-([A-Za-z0-9_-]{1,120}))?-before-send\.json$/;
const MAX_RESTORE_BYTES = 5 * 1024 * 1024;

interface VersionEntry {
  file: string;
  revision: number;
  createdAt: string;
  bytes: number;
}

async function listVersions(projectRoot: string): Promise<{ entries: VersionEntry[]; error?: { status: number; message: string } }> {
  const dir = resolve(projectRoot, ".intent", "versions");
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return { entries: [] };
  }
  const entries: VersionEntry[] = [];
  for (const name of names) {
    const match = VERSION_FILE.exec(name);
    if (!match) continue;
    try {
      const stats = await fs.stat(resolve(dir, name));
      // Filename stamp is ISO-ish with ':' replaced by '-'; best-effort reverse.
      const stamp = (match[1] ?? "").replace(/-([0-9]{2})-([0-9]{2})-([0-9]{3})/, ":$1:$2.$3").replace(/Z$/, "Z");
      const createdAt = stamp.endsWith("Z") ? stamp : `${stamp}Z`;
      entries.push({ file: name, revision: Number(match[2]), createdAt, bytes: stats.size });
    } catch {
      // skip unreadable entries
    }
  }
  entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  return { entries: entries.slice(0, 100) };
}

export async function handleVersionsList(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const sceneId = url.searchParams.get("sceneId") ?? "default";
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(sceneId)) {
    sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "Invalid sceneId" } });
    return;
  }
  const { entries } = await listVersions(ctx.projectRoot);
  sendJson(res, 200, { sceneId, versions: entries });
}

export async function handleVersionRestore(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL, file: string): Promise<void> {
  return withProjectLock(ctx.lockPort, "feedback", async () => {
    const sceneId = url.searchParams.get("sceneId") ?? "default";
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(sceneId)) {
      sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "Invalid sceneId" } });
      return;
    }
    const match = VERSION_FILE.exec(file);
    if (!match) {
      sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "Invalid version file name" } });
      return;
    }
    // Snapshots written by the current build carry the originating sceneId —
    // refuse cross-scene restores rather than silently grafting A's objects onto B.
    const embeddedSceneId = match[3];
    if (embeddedSceneId !== undefined && embeddedSceneId !== sceneId) {
      sendJson(res, 409, {
        error: { code: "E_CONFLICT", message: "That snapshot belongs to a different scene" },
      });
      return;
    }
    const dir = resolve(ctx.projectRoot, ".intent", "versions");
    const target = resolve(dir, file);
    const rel = relative(resolve(dir), target);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      sendJson(res, 400, { error: { code: "E_PATH_TRAVERSAL", message: "Path escapes versions directory" } });
      return;
    }
    let raw: string;
    try {
      const stats = await fs.stat(target);
      if (stats.size > MAX_RESTORE_BYTES) {
        sendJson(res, 413, { error: { code: "E_LIMIT", message: "Snapshot exceeds the 5 MB limit" } });
        return;
      }
      raw = await fs.readFile(target, "utf-8");
    } catch {
      sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Version not found" } });
      return;
    }
    let restored;
    try {
      restored = validateScene(JSON.parse(raw));
    } catch (err) {
      sendJson(res, 400, { error: { code: "E_SCHEMA", message: `Snapshot is invalid: ${(err as Error).message}` } });
      return;
    }
    const current = await ctx.storage.readScene(sceneId);
    if (!current) {
      sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Current scene not found" } });
      return;
    }
    // Snapshot the pre-restore scene so a mistaken restore is itself recoverable.
    await saveBeforeSendVersion(ctx.storage, ctx.projectRoot, sceneId);
    restored.revision = current.revision + 1;
    restored.updatedAt = new Date().toISOString();
    await ctx.storage.writeScene(sceneId, restored);
    ctx.broadcastRevision(sceneId, restored.revision);
    sendJson(res, 200, { ok: true, revision: restored.revision });
  });
}

/** Dispatches /api/versions routes. Returns true when handled. */
export async function registerVersionRoutes(
  ctx: ApiContext,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  url: URL,
): Promise<boolean> {
  if (pathname === "/api/versions" && req.method === "GET") {
    await handleVersionsList(ctx, req, res, url);
    return true;
  }
  const restoreMatch = /^\/api\/versions\/([^/]+)\/restore$/.exec(pathname);
  if (restoreMatch && req.method === "POST") {
    await handleVersionRestore(ctx, req, res, url, restoreMatch[1] ?? "");
    return true;
  }
  return false;
}
