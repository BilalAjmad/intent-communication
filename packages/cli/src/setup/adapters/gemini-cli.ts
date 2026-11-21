/** Adapter: Gemini CLI — official MCP docs fetched 2026-11-21 (settings.json/mcpServers). */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, commandTargets, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://geminicli.com/docs/tools/mcp-server/";
export default defineAdapter({
  id: "gemini-cli", name: "Gemini CLI", docsUrl: DOCS, docsVerified: true,
  detectPaths: { home: [".gemini"], project: [".gemini"] },
  targets(env, scope) {
    return scope === "user"
      ? [mcpJsonTarget(`${env.home}/.gemini/settings.json`, stdioEntry(env)), rulesTarget(`${env.home}/.gemini/GEMINI.md`)]
      : [mcpJsonTarget(`${env.projectRoot}/.gemini/settings.json`, stdioEntry(env)), rulesTarget(`${env.projectRoot}/GEMINI.md`), ...commandTargets(`${env.projectRoot}/.gemini/commands`)];
  },
  manual: () => manualSnippet("gemini-cli", DOCS, true),
});
