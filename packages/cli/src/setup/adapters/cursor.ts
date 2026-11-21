/** Adapter: Cursor — official MCP docs fetched 2026-11-21 (mcpServers, type stdio). */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, commandTargets, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://cursor.com/docs/context/mcp";
export default defineAdapter({
  id: "cursor", name: "Cursor", docsUrl: DOCS, docsVerified: true,
  detectPaths: { home: [".cursor"], project: [".cursor"] },
  targets(env, scope) {
    return scope === "user"
      ? [mcpJsonTarget(`${env.home}/.cursor/mcp.json`, stdioEntry(env, true)), rulesTarget(`${env.home}/.cursor/rules/intent.mdc`)]
      : [mcpJsonTarget(`${env.projectRoot}/.cursor/mcp.json`, stdioEntry(env, true)), rulesTarget(`${env.projectRoot}/.cursor/rules/intent.mdc`), ...commandTargets(`${env.projectRoot}/.cursor/commands`, "mdc")];
  },
  manual: () => manualSnippet("cursor", DOCS, true),
});
