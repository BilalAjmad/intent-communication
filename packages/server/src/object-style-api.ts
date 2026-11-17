import { IncomingMessage, ServerResponse } from "node:http";
import { writePipeline, ErrorCodes } from "@intent/core";
import { ObjectStylePatchInputSchema } from "@intent/schema";
import {
  ApiContext,
  newPatchId,
  sendJson,
  sendSchemaError,
  readJsonBody,
  sendBodyError,
} from "./api-helpers.js";

/**
 * trd 352/T9 — direct user edits of an object's style record (drag, resize).
 * The Studio sends the client-merged full style; the server applies it through
 * the SAME atomic writePipeline the agent's apply_patch uses (locks, revision
 * bump, E_CONFLICT on stale baseRevision). No feedback-queue entry is created:
 * a user's own drag is not agent work and must not lower the acceptance-rate
 * metric (trd 17.2). The revision bump is the record — visible via get_scene.
 * Coalescing is trivial here: one gesture = one op = one revision.
 */
export async function handleObjectStylePatch(ctx: ApiContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: unknown;
  try {
    body = await readJsonBody(req, 128 * 1024);
  } catch (err) {
    sendBodyError(res, err);
    return;
  }
  let input;
  try {
    input = ObjectStylePatchInputSchema.parse(body);
  } catch (err) {
    sendSchemaError(res, err);
    return;
  }

  const sceneId = input.sceneId;
  const scene = await ctx.storage.readScene(sceneId);
  if (!scene) {
    sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Scene not found" } });
    return;
  }

  const now = new Date().toISOString();
  const result = await writePipeline(ctx.storage, ctx.lockPort, sceneId, [
    {
      id: newPatchId(),
      sceneId,
      baseRevision: input.baseRevision,
      objectId: input.objectId,
      op: "set",
      path: "style",
      value: input.style,
      createdAt: now,
      status: "sent",
      appliedAt: null,
      conflictWith: null,
    },
  ]);

  if (result && typeof result === "object" && "success" in result) {
    const r = result as { success: boolean; revision: number; error?: string };
    if (r.success) {
      ctx.broadcastRevision(sceneId, r.revision);
      sendJson(res, 200, { ok: true, revision: r.revision });
      return;
    }
    if (r.error === ErrorCodes.E_CONFLICT) {
      sendJson(res, 409, {
        error: { code: "E_CONFLICT", message: "The scene changed since you last saw it — reload and try again" },
        revision: r.revision,
      });
      return;
    }
    if (r.error === ErrorCodes.E_LOCKED) {
      sendJson(res, 409, { error: { code: "E_LOCKED", message: "The object (or an ancestor of it) is locked" } });
      return;
    }
    sendJson(res, 400, { error: { code: r.error ?? "E_BAD_REQUEST", message: "The style patch was rejected" } });
    return;
  }
  sendJson(res, 500, { error: { code: "E_INTERNAL", message: "Style patch did not produce a result" } });
}

/** Dispatches /api/object-style. Returns true when handled. */
export async function registerObjectStyleRoutes(
  ctx: ApiContext,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (pathname === "/api/object-style" && req.method === "POST") {
    await handleObjectStylePatch(ctx, req, res);
    return true;
  }
  return false;
}
