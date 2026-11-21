import { resolve } from "node:path";
import { INTENT_COMMAND_BODY, PROTOTYPE_COMMAND_BODY } from "@intent/skills";
import type { SetupTarget } from "./types.js";

const START = "<!-- intent:setup:start -->";
const END = "<!-- intent:setup:end -->";

/** Rules block appended to an agent's rules file. Merge-only, marker-delimited. */
export const SETUP_RULES_BLOCK = `${START}
## Intent
For design or UI work in this project, use the Intent MCP tools (one question at a time with ask_user; get_scene/apply_patch/get_feedback for the scene; validate before claiming success). Agents without slash commands can say \`intent:\` to start the interview or \`prototype:\` to open the Studio and edit visually. Never hand-write UI outside these tools.
${END}
`;

import type { SetupEnv } from "./types.js";

export function stdioEntry(env: SetupEnv, withType = false): Record<string, unknown> {
  return withType ? { type: "stdio", command: env.intentCommand.command, args: env.intentCommand.args } : { command: env.intentCommand.command, args: env.intentCommand.args };
}

export function mcpJsonTarget(path: string, entry: Record<string, unknown>, jsonKey = "mcpServers"): SetupTarget {
  return { kind: "mcp", path, entry, jsonKey };
}

export function rulesTarget(path: string, content = SETUP_RULES_BLOCK): SetupTarget {
  return { kind: "rules", path, content };
}

export function commandTargets(dir: string, ext = "md"): SetupTarget[] {
  return [
    { kind: "command", path: resolve(dir, `intent.${ext}`), content: INTENT_COMMAND_BODY, commandName: "intent" },
    { kind: "command", path: resolve(dir, `prototype.${ext}`), content: PROTOTYPE_COMMAND_BODY, commandName: "prototype" },
  ];
}

export const SETUP_MARKERS = { START, END };

/** Manual fallback shown for every agent (and the only option for UNVERIFIED formats). */
export function manualSnippet(agentId: string, docsUrl: string, verified: boolean): string {
  return [
    `Manual setup for ${agentId} (${verified ? "official docs verified 2026-11-21" : "UNVERIFIED — follow your agent's current docs"})`,
    `Docs: ${docsUrl}`,
    "Add this MCP server entry (command path is the absolute path to your installed `intent` binary / node + intent.cjs):",
    '{"mcpServers":{"intent":{"command":"<absolute-node-or-intent-path>","args":["<path-to-intent.cjs>","mcp"]}}}',
    "Do not paste secrets into config files. Restart the agent, then say `intent:` or `prototype:`.",
  ].join("\n");
}
