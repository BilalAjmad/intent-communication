import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { IntentError, ErrorCodes } from "@intent/core";
import { validateScene, type Scene } from "@intent/schema";

/**
 * Shared reader for the acceptance-metric baseline (trd 17.2): the earliest
 * `*-first-render.json` snapshot in `.intent/versions/`. Used by both the
 * Studio server (metrics-api) and the CLI (`intent export`), so the baseline
 * definition lives in exactly one place.
 *
 * Returns null when no baseline exists or the snapshot is unreadable — never
 * fabricates a baseline.
 */
const FIRST_RENDER_FILE = /^([0-9A-Za-z_\-:.]+)Z-r(\d+)(?:-([A-Za-z0-9_-]{1,120}))?-first-render\.json$/;
const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;

export interface FirstRenderBaseline {
  file: string;
  revision: number;
  createdAt: string;
  capturedAtMs: number;
  scene: Scene;
}

// The first-render marker regex consumes the trailing 'Z' as its own literal,
// so group1 arrives WITHOUT it: "2026-11-16T00-00-00-000". We rebuild the ISO.
function stampToIso(stamp: string): string {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2})-(\d{2})-(\d{2})-(\d{3})$/.exec(stamp);
  if (!match) return "";
  return `${match[1]}:${match[2]}:${match[3]}.${match[4]}Z`;
}

/**
 * @param sceneId when given, only baselines stamped for that scene are
 * considered (new-style markers embed the scene). Legacy markers without an
 * embedded scene are included for any scene — they cannot be attributed.
 */
export async function findFirstRenderBaseline(projectRoot: string, sceneId?: string): Promise<FirstRenderBaseline | null> {
  const dir = resolve(projectRoot, ".intent", "versions");
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return null;
  }

  const candidates: { name: string; match: RegExpExecArray }[] = [];
  for (const name of names) {
    const match = FIRST_RENDER_FILE.exec(name);
    const embeddedScene = match?.[3];
    if (sceneId !== undefined && embeddedScene !== undefined && embeddedScene !== sceneId) continue;
    // Skip candidates whose stamp is unparseable — a bogus filename must not
    // sort ahead of every real baseline and null the whole function.
    if (match && Date.parse(stampToIso(match[1] ?? "")) > 0) candidates.push({ name, match });
  }
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const ta = Date.parse(stampToIso(a.match[1] ?? "")) || 0;
    const tb = Date.parse(stampToIso(b.match[1] ?? "")) || 0;
    const nameCompare = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    return ta - tb || nameCompare;
  });

  const earliest = candidates[0] as (typeof candidates)[number];
  const createdAt = stampToIso(earliest.match[1] ?? "");
  if (!createdAt) return null;

  const target = resolve(dir, earliest.name);
  let raw: string;
  try {
    const stats = await fs.stat(target);
    if (stats.size > MAX_SNAPSHOT_BYTES) {
      throw new IntentError(ErrorCodes.E_LIMIT, "Baseline snapshot exceeds the 5 MB limit");
    }
    raw = await fs.readFile(target, "utf-8");
  } catch (err) {
    if (err instanceof IntentError) throw err;
    return null;
  }

  try {
    return {
      file: earliest.name,
      revision: Number(earliest.match[2] ?? 0),
      createdAt,
      capturedAtMs: Date.parse(createdAt),
      scene: validateScene(JSON.parse(raw)),
    };
  } catch {
    return null; // corrupt baseline: treat as unavailable rather than fabricate
  }
}
