import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { writeAtomic } from "@intent/core";

const BLOCK_START = "<!-- intent:start -->";
const BLOCK_END = "<!-- intent:end -->";

export const INTENT_AGENTS_BLOCK = [
  BLOCK_START,
  "",
  "## Intent",
  "",
  "This project has Intent initialized (`.intent/`). For design or UI work:",
  "",
  "- Read `.intent/rules/intent-core.md` and `.intent/rules/tool-usage.md` first.",
  "- Interview the user with the `ask_user` tool, ONE question at a time — never free-chat.",
  "- After `/intent` saves an approved brief, use `/prototype`: create screens/objects with `create_object` (apply_patch can ONLY modify existing objects, never create them).",
  "- Use `get_scene` to read the current scene; `apply_patch` for edits; `get_feedback` for sent feedback.",
  "- Before export, `validate` must return valid:true AND lint pass (zero violations). Fix every lint violation first.",
  "- Do not open the Studio unless the user explicitly asks (`open_studio`).",
  "",
  BLOCK_END,
  "",
].join("\n");

export interface AgentsBlockResult {
  /** true if AGENTS.md would change (or changed). */
  changed: boolean;
  file: string;
  action: "created" | "appended" | "replaced" | "unchanged";
}

/**
 * Ensure the project's AGENTS.md carries the Intent pointer block.
 * - missing file  → create it containing only the block
 * - no block      → append the block (user content untouched)
 * - block present → replace its contents in place (idempotent)
 * Never touches content outside the markers. `--dry-run` reports only.
 */
export async function ensureAgentsIntentBlock(
  projectRoot: string,
  options: { dryRun: boolean },
): Promise<AgentsBlockResult> {
  const file = resolve(projectRoot, "AGENTS.md");
  const { dryRun } = options;

  let raw: string | null = null;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  if (raw === null) {
    if (!dryRun) await writeAtomic(file, INTENT_AGENTS_BLOCK);
    return { changed: true, file, action: "created" };
  }

  try {
    const st = await fs.lstat(file);
    if (st.isSymbolicLink()) {
      throw new Error("AGENTS.md is a symlink — refusing to edit outside the project root");
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("symlink")) throw err;
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  const start = raw.indexOf(BLOCK_START);
  const end = raw.indexOf(BLOCK_END);
  const startCount = raw.split(BLOCK_START).length - 1;
  const endCount = raw.split(BLOCK_END).length - 1;
  if (start !== -1 && end !== -1 && end > start && startCount === 1 && endCount === 1) {
    const before = raw.slice(0, start);
    const after = raw.slice(end + BLOCK_END.length);
    const merged = before + INTENT_AGENTS_BLOCK.trimEnd() + after;
    const changed = merged !== raw;
    if (!dryRun && changed) await writeAtomic(file, merged);
    return { changed, file, action: changed ? "replaced" : "unchanged" };
  }
  if (start !== -1 || end !== -1) {
    // Orphan or DUPLICATE markers: never guess where the block belongs —
    // documenting the markers in a code sample must not be mistaken for the block.
    throw new Error(
      `AGENTS.md has ambiguous intent markers (start: ${start}\u00d7${startCount}, end: ${end}\u00d7${endCount}); refusing to edit — remove or fix the markers manually`,
    );
  }

  const merged = raw.endsWith("\n") || raw.length === 0 ? raw + INTENT_AGENTS_BLOCK : raw + "\n" + INTENT_AGENTS_BLOCK;
  if (!dryRun) await writeAtomic(file, merged);
  return { changed: true, file, action: "appended" };
}
