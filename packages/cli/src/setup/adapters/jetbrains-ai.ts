/** Adapter: JetBrains AI Assistant — IDE-managed config (UNVERIFIED today); manual snippet only. */
import { defineAdapter } from "../factory.js";
import { rulesTarget, manualSnippet } from "../targets.js";

const DOCS = "https://www.jetbrains.com/help/ai-assistant/configure-mcp-server.html";
export default defineAdapter({
  id: "jetbrains-ai", name: "JetBrains AI", docsUrl: DOCS, docsVerified: false,
  manualOnly: true, note: "MCP servers are managed in IDE settings; no automatic file edit is safe.",
  detectPaths: { home: [".config/JetBrains", "AppData/Roaming/JetBrains"], project: [".idea"] },
  targets(env, _scope) {
    return [rulesTarget(`${env.projectRoot}/AGENTS.md`)];
  },
  manual: () => manualSnippet("jetbrains-ai", DOCS, false),
});
