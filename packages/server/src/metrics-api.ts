import { IncomingMessage, ServerResponse } from "node:http";
import { computeAcceptanceRate, IntentError, ErrorCodes } from "@intent/core";
import { findFirstRenderBaseline } from "@intent/adapters-node";
import type { Scene, SceneObject } from "@intent/schema";
import {
  ApiContext,
  sendJson,
} from "./api-helpers.js";

/**
 * trd 17.2 acceptance-rate metric. Read-only.
 *
 * Baseline definition: the `first-render` version snapshot (written on the
 * first successful `apply_patch`, see mcp-server first-render.ts). If no
 * snapshot exists yet, the metric is `available: false` with a reason instead
 * of a fabricated number. Patches without a parseable `appliedAt` cannot be
 * attributed to before/after the baseline and are excluded from the
 * changed-set, which is the conservative direction.
 */

/** Non-screen scene objects — trd 17.2 counts objects, not screens. */
function nonScreenObjects(scene: Scene): Record<string, SceneObject> {
  const out: Record<string, SceneObject> = {};
  for (const [id, obj] of Object.entries(scene.objects)) {
    if (obj.type === "screen") continue;
    out[id] = obj;
  }
  return out;
}

export async function handleMetricsGet(ctx: ApiContext, req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const sceneId = url.searchParams.get("sceneId") ?? "default";
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(sceneId)) {
    sendJson(res, 400, { error: { code: "E_BAD_REQUEST", message: "Invalid sceneId" } });
    return;
  }

  let baseline;
  try {
    baseline = await findFirstRenderBaseline(ctx.projectRoot, sceneId);
  } catch (err) {
    if (err instanceof IntentError && err.code === ErrorCodes.E_LIMIT) {
      sendJson(res, 413, { error: { code: "E_LIMIT", message: err.message } });
      return;
    }
    throw err;
  }

  const current = await ctx.storage.readScene(sceneId);
  if (!current) {
    sendJson(res, 404, { error: { code: "E_NOT_FOUND", message: "Scene not found" } });
    return;
  }

  if (!baseline) {
    sendJson(res, 200, {
      sceneId,
      baseline: null,
      metrics: {
        available: false,
        reason: "no baseline yet — the first agent write creates one",
        total: Object.keys(nonScreenObjects(current)).length,
        baselineObjects: 0,
        baselineObjectsStillPresent: 0,
        unchanged: 0,
        changed: 0,
        addedAfterBaseline: 0,
        removedAfterBaseline: 0,
        acceptanceRate: null,
      },
    });
    return;
  }

  const feedback = await ctx.storage.readFeedback(sceneId);
  const appliedPatches = feedback
    .filter((f) => f.status === "applied")
    .map((f) => ({ objectId: f.objectId as string | null, appliedAt: f.appliedAt }));

  const metrics = computeAcceptanceRate({
    baselineObjects: nonScreenObjects(baseline.scene),
    currentObjects: nonScreenObjects(current),
    appliedPatches,
    baselineCapturedAt: baseline.createdAt,
  });

  sendJson(res, 200, {
    sceneId,
    baseline: { file: baseline.file, revision: baseline.revision, createdAt: baseline.createdAt },
    metrics,
  });
}

/** Dispatches /api/metrics routes. Returns true when handled. */
export async function registerMetricsRoutes(
  ctx: ApiContext,
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  url: URL,
): Promise<boolean> {
  if (pathname === "/api/metrics" && req.method === "GET") {
    await handleMetricsGet(ctx, req, res, url);
    return true;
  }
  return false;
}
