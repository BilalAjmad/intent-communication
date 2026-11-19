/** Slash-command contracts shipped by `intent init` and the global install.
 *  `/intent` = interview + understanding. `/prototype` = Studio/visual edits.
 *  Both are idempotent prompt files — an agent that loads one follows the rules
 *  for the whole session (no need to paste it every message). */
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";

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

export const INTENT_SLASH = `<!-- intent:command:start -->
# /intent — deep interview (understand before building)
Use the Intent rules in this project. Read the "intent" block in AGENTS.md first.
For this whole session, ALL design/UI/app work goes through the Intent MCP tools:
- ONE question at a time with the ask_user tool. Never free-chat design decisions.
- Ask about: goal, users, screens, flow, style, content, behavior, edge cases.
- Use numbered options; 0 = "don't know, you choose", s = "skip". Prefer answerText from prior answers.
- Read current scene with get_scene. Apply edits with apply_patch.
- Check user feedback with get_feedback; open the browser Studio with open_studio only when asked.
- Validate data with validate before claiming anything correct.
- Never claim a match percentage as a result. 97% is a target, not measured.
<!-- intent:command:end -->
`;

export const PROTOTYPE_SLASH = `<!-- intent:command:start -->
# /prototype — visual editing in the Studio
Use the Intent MCP tools for this whole session:
- get_scene to inspect; open_studio to open the local browser Studio (only on user request).
- The user edits visually in the Studio (select, drag, nudge, annotate, send feedback).
- After the user sends feedback, call get_feedback to read it once, then apply_patch to update the scene.
- Re-check with get_scene and validate. Never implement UI freehand outside these tools.
- To deliver a prototype: intent export -s default -o my-app.html (or ask the user to run it).
<!-- intent:command:end -->
`;

/** Project-level command files written by init (per agent conventions). */
export function slashCommandFiles(_projectRoot: string): { file: string; content: string }[] {
  return [
    { file: ".claude/commands/intent.md", content: INTENT_SLASH },
    { file: ".claude/commands/prototype.md", content: PROTOTYPE_SLASH },
    { file: ".cursor/commands/intent.mdc", content: INTENT_SLASH },
    { file: ".cursor/commands/prototype.mdc", content: PROTOTYPE_SLASH },
  ];
}
