/** Slash-command contracts shipped by `intent init` and the global install.
 *  `/intent` = interview only. `/prototype` = Studio/visual edits.
 *  The canonical text lives in `@intent/skills` (single source of truth); these
 *  files are generated from it and a drift test in that package guards them.
 *  Prompt files are idempotent — an agent that loads one follows the rules for
 *  the whole session (no need to paste it every message). */
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { INTENT_COMMAND_BODY, PROTOTYPE_COMMAND_BODY, intentCommandFiles } from "@intent/skills";

/** Write project-scoped slash files through the caller's idempotent writer. */
export async function writeSlashCommandFiles(
  projectRoot: string,
  write: (file: string, content: string, label: string) => Promise<void>,
): Promise<void> {
  for (const cmd of slashCommandFiles(projectRoot)) {
    await fs.mkdir(dirname(resolve(projectRoot, cmd.file)), { recursive: true });
    await write(resolve(projectRoot, cmd.file), cmd.content, "Slash command");
  }
}

/** Backwards-compatible aliases for callers/tests importing from the CLI. */
export const INTENT_SLASH = INTENT_COMMAND_BODY;
export const PROTOTYPE_SLASH = PROTOTYPE_COMMAND_BODY;

/** Project-level command files written by init (per agent conventions). */
export function slashCommandFiles(projectRoot: string): { file: string; content: string }[] {
  return intentCommandFiles(projectRoot);
}
