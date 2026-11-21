/** Adapter: Claude Code — official MCP docs fetched 2026-11-21. */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, commandTargets, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://code.claude.com/docs/en/mcp";
export default defineAdapter({
  id: "claude-code", name: "Claude Code", docsUrl: DOCS, docsVerified: true,
  detectPaths: { home: [".claude", ".claude.json"], project: [".claude"] },
  targets(env, scope) {
    return scope === "user"
      ? [mcpJsonTarget(`${env.home}/.claude.json`, stdioEntry(env)), rulesTarget(`${env.home}/.claude/CLAUDE.md`)]
      : [mcpJsonTarget(`${env.projectRoot}/.mcp.json`, stdioEntry(env)), rulesTarget(`${env.projectRoot}/.claude/CLAUDE.md`), ...commandTargets(`${env.projectRoot}/.claude/commands`)];
  },
  manual: () => manualSnippet("claude-code", DOCS, true),
});
