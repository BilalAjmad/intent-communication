/**
 * Canonical slash-command source (final master order 2026-11-21, section B).
 *
 * One source of truth for `/intent` and `/prototype`. Every agent-specific file
 * is generated from these strings; `slash-commands.test.ts` fails if a generated
 * file drifts from the canonical body.
 */

/** Per-agent command file locations (project scope). */
export interface CommandFile {
  file: string;
  content: string;
}

const MARKER_START = "<!-- intent:command:start -->";
const MARKER_END = "<!-- intent:command:end -->";

export const INTENT_COMMAND_BODY = `${MARKER_START}
# /intent — interview only (understand before building)
You are running the Intent interview. Do NOT build UI, write scene patches, or export in this session.

Rules:
- ONE question at a time through the \`ask_user\` MCP tool. Never stack questions and never free-chat design decisions.
- Required topics, all six: \`goal\`, \`users\`, \`screens\`, \`flow\`, \`style\`, \`content\`. A topic counts only when the USER stated evidence — an assumption does not count.
- Every question carries numbered options plus \`0) Don't know, you choose\` and \`s) Skip\`.
- There is NO hard question limit. Keep asking past the soft cap until all six required topics are covered with stated evidence AND the user picks "Exactly right" on the summary.
- The meter is an honest estimate. The server caps it at **89** while any required topic is uncovered; 100 is reachable only from real evidence. Never quote 97% or any acceptance percentage as a result.
- Read the current scene with \`get_scene\`; validate data with \`validate\`; open the Studio with \`open_studio\` only when the user asks.
- When the user picks "Exactly right", the server saves the approved brief to \`.intent/briefs/<id>.json\` and marks the interview complete. Then stop and tell the user to run \`/prototype\`.
${MARKER_END}
`;

export const PROTOTYPE_COMMAND_BODY = `${MARKER_START}
# /prototype — build the approved prototype in the Studio
You are running the Intent prototype session.

Rules:
- If there is no approved brief (a \`.intent/briefs/*.json\` with \`approvalStatus: "approved"\`), STOP and tell the user to run \`/intent\` first. Never invent a brief.
- Read the approved brief. Put art direction into scene metadata: ONE concrete visual idea; a palette of neutrals plus exactly ONE accent taken from the project's token names and contrast-checked; a system-font type plan with at most 3 sizes; a 4/8 spacing rhythm. The layout is NOT a centered hero over three equal cards.
- **Build flow: you CAN create screens and objects with \`create_object\` (use it to build the prototype from the brief). Then refine with \`apply_patch\` (modify props/style/meta/states of existing objects). You may also let the user create objects in the Studio. Never hand-write UI outside these tools.**
- **Correct flow: (1) \`create_object\` for the screen + components. (2) Refine with \`apply_patch\`. (3) \`open_studio\` so the user can edit visually. (4) User sends feedback. (5) You call \`get_feedback\` once. (6) You modify via \`apply_patch\`. (7) Re-check with \`get_scene\` and \`validate\`. (8) Export with \`intent export\`.**
- Read the current scene with \`get_scene\`. Change it ONLY with \`apply_patch\`; verify with \`get_scene\` and \`validate\`. Never hand-write UI outside these tools.
- This command is the user's explicit request to open the Studio: call \`open_studio\` and pass the user's own words as \`quote\` — never your paraphrase presented as theirs.
- The user edits visually in the Studio: select, drag, resize, nudge, annotate, send feedback. After feedback, call \`get_feedback\` once, then \`apply_patch\`. Re-check and validate.
- Export the result: \`intent export -s default -o <name>.html\` (or ask the user to run it).
- Anti-slop rules apply (design-principles.md): no lorem ipsum or placeholder copy; no emoji icons; no purple-blue gradient hero; no three identical feature cards; not everything centered; no shadow + rounded-xl on everything; no fake logos, testimonials or stats; no vague copy ("Welcome to", "Unlock the power of", "seamless", "revolutionary"); no generic names (John Doe, Acme). Use realistic domain content, one primary action per screen, a clear heading hierarchy, all states, light AND dark themes, WCAG contrast, 44px targets and visible focus.
${MARKER_END}
`;

export const INTENT_COMMAND_FILE = "intent";
export const PROTOTYPE_COMMAND_FILE = "prototype";

/** Project-scoped command files generated from the canonical bodies. */
export function intentCommandFiles(_projectRoot: string): CommandFile[] {
  return [
    { file: `.claude/commands/${INTENT_COMMAND_FILE}.md`, content: INTENT_COMMAND_BODY },
    { file: `.claude/commands/${PROTOTYPE_COMMAND_FILE}.md`, content: PROTOTYPE_COMMAND_BODY },
    { file: `.cursor/commands/${INTENT_COMMAND_FILE}.mdc`, content: INTENT_COMMAND_BODY },
    { file: `.cursor/commands/${PROTOTYPE_COMMAND_FILE}.mdc`, content: PROTOTYPE_COMMAND_BODY },
  ];
}

/** Trigger phrases for agents that have no slash-command files (AGENTS.md block). */
export const INTENT_TRIGGER_PHRASE = "intent:";
export const PROTOTYPE_TRIGGER_PHRASE = "prototype:";

export { MARKER_START, MARKER_END };
