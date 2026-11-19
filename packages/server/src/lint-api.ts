import { IncomingMessage, ServerResponse } from "node:http";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { lintScene, type LintProfile } from "@intent/linter";
import {
  ApiContext,
  sendJson,
} from "./api-helpers.js";

/** Read .intent/design-profile.json if the project was scanned (trd 16); never errors. */
async function readLintProfile(projectRoot: string): Promise<LintProfile | undefined> {
  try {
    const path = resolve(projectRoot, ".intent", "design-profile.json");
    const stats = await fs.stat(path);
    if (stats.size > 512 * 1024) return undefined; // oversized profile: fall back to built-ins
    const raw = await fs.readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as { tokens?: { colors?: unknown } };
    const colors = parsed?.tokens?.colors;
    if (!colors || typeof colors !== "object" || Array.isArray(colors)) return undefined;
    // Reject profiles with non-string values — they would crash the linter's hex parser.
    for (const value of Object.values(colors)) {
      if (typeof value !== "string") return undefined;
    }
    return { tokens: { colors: colors as Record<string, string> } };
  } catch {
    return undefined; // no scan yet — the linter falls back to its built-in reference palette
  }
}

/**
 * GET /api/lint (trd 11.3): run the full M1+M2 linter against the current
 * scene and return the violations. Session-authenticated like the other
 * /api routes; read-only; never mutates the scene.
 */
function isSafeId(id: string): boolean {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,120}$/.test(id);
}

export async function handleApiLint(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const sceneId = url.searchParams.get("sceneId") ?? url.searchParams.get("scene") ?? "default";
  if (!isSafeId(sceneId)) {
    sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "Invalid sceneId" } });
    return;
  }
  const scene = await ctx.storage.readScene(sceneId);
  if (!scene) {
    sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Scene not found" } });
    return;
  }
  const locks = await ctx.lockPort.getLockedObjects(sceneId);
  const profile = await readLintProfile(ctx.projectRoot);
  const result = lintScene(scene, locks, profile);
  sendJson(res, 200, { revision: scene.revision, ...result });
}

/** Dispatches the /api/lint route. Returns true when handled. */
export async function registerLintRoutes(
  ctx: ApiContext,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  url: URL,
): Promise<boolean> {
  if (pathname === "/api/lint" && req.method === "GET") {
    await handleApiLint(ctx, req, res, url);
    return true;
  }
  return false;
}
