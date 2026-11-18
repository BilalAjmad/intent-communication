import { IncomingMessage, ServerResponse } from "node:http";
import { validateScene } from "@intent/schema";
import { KeyframesPutInputSchema } from "@intent/schema";
import {
  ApiContext,
  sendJson,
  sendSchemaError,
  readJsonBody,
  sendBodyError,
} from "./api-helpers.js";

/**
 * trd 13.6 — scene-wide @keyframes table, authored in the Studio.
 * GET returns the current table; PUT replaces the whole table wholesale
 * (one edit = one revision). No object lock applies — this is scene-level
 * metadata, not an object, so the versions-restore precedent (revision bump +
 * SSE broadcast, stale baseRevision -> 409) is the right shape. The engine
 * sanitizes the table again at render time; values here are already bound by
 * the schema grammars (closed property/offset/name space, 64 KB cap).
 */
export async function handleKeyframesGet(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const sceneId = url.searchParams.get("sceneId") || "default";
  const scene = await ctx.storage.readScene(sceneId);
  if (!scene) {
    sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Scene not found" } });
    return;
  }
  sendJson(res, 200, { ok: true, keyframes: scene.metadata?.keyframes ?? {}, revision: scene.revision });
}

export async function handleKeyframesPut(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const sceneIdParam = url.searchParams.get("sceneId");
  let body: unknown;
  try {
    body = await readJsonBody(req, 128 * 1024);
  } catch (err) {
    sendBodyError(res, err);
    return;
  }
  let input;
  try {
    input = KeyframesPutInputSchema.parse({ ...(body as Record<string, unknown>), ...(sceneIdParam ? { sceneId: sceneIdParam } : {}) });
  } catch (err) {
    sendSchemaError(res, err);
    return;
  }

  const scene = await ctx.storage.readScene(input.sceneId);
  if (!scene) {
    sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Scene not found" } });
    return;
  }
  if (input.baseRevision !== scene.revision) {
    sendJson(res, 409, {
      error: { code: "E_CONFLICT", message: "The scene changed since you last saw it — reload and try again" },
      revision: scene.revision,
    });
    return;
  }

  // Replace the table wholesale. metadata itself is schema-validated again on
  // write so a hand-crafted body can never bypass the closed grammars.
  const next = JSON.parse(JSON.stringify(scene)) as typeof scene;
  next.metadata = { ...(next.metadata ?? { name: "Untitled Project", tags: [] }), keyframes: input.keyframes };
  next.revision = scene.revision + 1;
  next.updatedAt = new Date().toISOString();
  const validated = validateScene(next);

  await ctx.storage.writeScene(input.sceneId, validated);
  ctx.broadcastRevision(input.sceneId, validated.revision);
  sendJson(res, 200, { ok: true, revision: validated.revision, keyframes: validated.metadata.keyframes });
}

/** Dispatches /api/keyframes. Returns true when handled. */
export async function registerKeyframesRoutes(
  ctx: ApiContext,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  url: URL,
): Promise<boolean> {
  if (pathname === "/api/keyframes" && req.method === "GET") {
    await handleKeyframesGet(ctx, req, res, url);
    return true;
  }
  if (pathname === "/api/keyframes" && req.method === "PUT") {
    await handleKeyframesPut(ctx, req, res, url);
    return true;
  }
  return false;
}
