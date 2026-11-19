/**
 * trd 16 — shared filesystem walk for the Scanner: allowlisted directories,
 * depth cap, 512 KB per-file limit. Everything else in the scanner builds on
 * these primitives. Nothing is executed, ever.
 */
import { promises as fs } from "node:fs";
import { join, relative, sep } from "node:path";

export const MAX_FILE_BYTES = 512 * 1024;
export const MAX_WALK_DEPTH = 4;

export const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", ".next", "coverage", ".cache"]);

export const relOf = (projectRoot: string, file: string): string =>
  relative(projectRoot, file).split(sep).join("/");

export async function* walkFiles(dir: string, depth: number): AsyncGenerator<string> {
  if (depth > MAX_WALK_DEPTH) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // dot-dirs are handled explicitly, never walked
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walkFiles(full, depth + 1);
      continue;
    }
    if (entry.isFile()) yield full;
  }
}

export async function newestMtime(files: string[]): Promise<string> {
  let newest = 0;
  for (const f of files) {
    try {
      const stats = await fs.stat(f);
      if (stats.mtimeMs > newest) newest = stats.mtimeMs;
    } catch {
      // ignore unreadable source for the timestamp
    }
  }
  return (newest > 0 ? new Date(newest) : new Date(0)).toISOString();
}

export async function readUnderLimit(file: string): Promise<string | null> {
  try {
    const stats = await fs.stat(file);
    if (stats.size > MAX_FILE_BYTES) return null;
    return await fs.readFile(file, "utf-8");
  } catch {
    return null;
  }
}
