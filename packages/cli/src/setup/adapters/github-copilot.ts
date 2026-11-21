/** Adapter: GitHub Copilot (VS Code) — official docs fetched 2026-11-21 (.mcp.json). */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://code.visualstudio.com/docs/copilot/chat/mcp-servers";
export default defineAdapter({
  id: "github-copilot", name: "GitHub Copilot (VS Code)", docsUrl: DOCS, docsVerified: true,
  detectPaths: { home: [".vscode"], project: [".vscode", ".mcp.json"] },
  targets(env, scope) {
    return scope === "user"
      ? [rulesTarget(`${env.home}/.copilot-instructions.md`)]
      : [mcpJsonTarget(`${env.projectRoot}/.mcp.json`, stdioEntry(env)), rulesTarget(`${env.projectRoot}/.github/copilot-instructions.md`)];
  },
  manual: () => manualSnippet("github-copilot", DOCS, true),
});
