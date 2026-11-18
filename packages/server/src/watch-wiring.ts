import { resolve } from "node:path";
import { createFileWatcher } from "@intent/adapters-node";
import type { ApiContext } from "./api-helpers.js";

/**
 * trd 9.4 — the Studio server's watcher over `.intent/`. Emits the same SSE
 * events the write paths emit; the browser treats them identically (the
 * Studio's SSE handler is idempotent, so server-originated writes seen twice
 * — once from the API call, once from the watcher — cost one no-op refetch).
 *
 * Coverage: `scenes/<id>.json` → revision broadcast (Studio refetches);
 * `interview/state.json` → interview.changed; `feedback/<id>.json` →
 * patch.changed (external rewrites of the queue). Locks are not broadcast:
 * they surface via /api/scene's `locked` field on the next revision-driven
 * refetch (documented gap, not a silent one).
 */
export function startIntentWatcher(projectRoot: string, ctx: ApiContext, onDegraded: () => void): () => void {
  const dir = resolve(projectRoot, ".intent");
  const handlePath = async (rel: string): Promise<void> => {
    const sceneMatch = /^scenes\/([A-Za-z0-9_-]{1,120})\.json$/.exec(rel);
    if (sceneMatch) {
      try {
        const scene = await ctx.storage.readScene(sceneMatch[1]!);
        if (scene && typeof scene.revision === "number") {
          ctx.broadcastRevision(sceneMatch[1]!, scene.revision);
        }
      } catch {
        // Unparseable scene file — the Studio keeps its current state; the
        // next write reconciles with a revision bump (TC-WRT-11).
      }
      return;
    }
    if (rel === "interview/state.json") {
      try {
        const state = await ctx.storage.readInterviewState();
        ctx.broadcastInterviewChanged(state?.status ?? "changed");
      } catch {
        ctx.broadcastInterviewChanged("changed");
      }
      return;
    }
    const feedbackMatch = /^feedback\/([A-Za-z0-9_-]{1,120})\.json$/.exec(rel);
    if (feedbackMatch) {
      // Queue rewritten outside the server — one nudge is enough; the Studio
      // refetches the whole queue on this event.
      ctx.broadcastPatchChanged(feedbackMatch[1]!, "external", "changed");
    }
  };
  const watcher = createFileWatcher(dir, (rel) => void handlePath(rel), { onFallback: onDegraded });
  return () => watcher.close();
}
