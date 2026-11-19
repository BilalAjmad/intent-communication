import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { writeAtomic } from "@intent/core";
import type { MCPContext } from "./index.js";

/**
 * trd 17.2 baseline marker: the scene at the first successful apply_patch to
 * a scene is the reference point for the acceptance-rate metric ("the first
 * scene the agent wrote"). Stored as a version file in `.intent/versions/` so
 * it reuses the same snapshot machinery; the Snapshots UI only recognizes the
 * before-send pattern and ignores this file by design — it is a metric
 * baseline, not a user-facing restore point.
 *
 * Best effort: a marker failure must never fail the patch itself.
 */
const FIRST_RENDER_FILE = /^([0-9A-Za-z_\-:.]+)Z-r(\d+)(?:-([A-Za-z0-9_-]{1,120}))?-first-render\.json$/;

export async function saveFirstRenderVersion(context: MCPContext, sceneId: string): Promise<void> {
  try {
    const dir = resolve(context.projectRoot, ".intent", "versions");
    let names: string[] = [];
    try {
      names = await fs.readdir(dir);
    } catch {
      // dir missing — this is the first marker ever; proceed to create it.
    }
    // Per-scene markers: a baseline marker for scene B must not suppress A's.
    if (names.some((name) => FIRST_RENDER_FILE.exec(name)?.[3] === sceneId)) return;


    const scene = await context.storage.readScene(sceneId);
    if (!scene) return;
    await fs.mkdir(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = resolve(dir, `${stamp}-r${scene.revision}-${sceneId}-first-render.json`);
    await writeAtomic(file, JSON.stringify(scene, null, 0));
  } catch {
    // Best effort — never block the patch over a metric marker.
  }
}
