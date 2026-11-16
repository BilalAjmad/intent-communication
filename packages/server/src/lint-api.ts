import { IncomingMessage, ServerResponse } from "node:http";
import { lintScene } from "@intent/linter";
import {
  ApiContext,
  sendJson,
} from "./api-helpers.js";

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
  const result = lintScene(scene, locks);
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
