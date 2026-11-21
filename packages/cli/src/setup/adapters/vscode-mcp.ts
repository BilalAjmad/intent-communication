/** Adapter: VS Code MCP (standalone) — same workspace config as Copilot; user path UNVERIFIED. */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://code.visualstudio.com/docs/copilot/chat/mcp-servers";
export default defineAdapter({
  id: "vscode-mcp", name: "VS Code MCP", docsUrl: DOCS, docsVerified: true,
  note: "User-level mcp.json location varies by platform; project scope is verified.",
  detectPaths: { home: [".config/Code/User", "AppData/Roaming/Code/User"], project: [".vscode"] },
  targets(env, scope) {
    return scope === "user"
      ? [rulesTarget(`${env.home}/.config/Code/User/intent.md`)]
      : [mcpJsonTarget(`${env.projectRoot}/.mcp.json`, stdioEntry(env)), rulesTarget(`${env.projectRoot}/.vscode/intent.md`)];
  },
  manual: () => manualSnippet("vscode-mcp", DOCS, true),
});
