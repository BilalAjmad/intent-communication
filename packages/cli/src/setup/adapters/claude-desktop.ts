/** Adapter: Claude Desktop — user-scope config JSON, platform-dependent path (UNVERIFIED today). */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://modelcontextprotocol.io/quickstart/user";
export default defineAdapter({
  id: "claude-desktop", name: "Claude Desktop", docsUrl: DOCS, docsVerified: false,
  manualOnly: true, note: "Config lives in the OS application-support folder; verify the path with the manual snippet.",
  detectPaths: { home: ["AppData/Roaming/Claude", "Library/Application Support/Claude", ".config/Claude"] },
  targets(env, scope) {
    if (scope === "project") return [rulesTarget(`${env.projectRoot}/AGENTS.md`)];
    const base = env.platform === "win32"
      ? `${env.home}/AppData/Roaming/Claude`
      : env.platform === "darwin"
        ? `${env.home}/Library/Application Support/Claude`
        : `${env.home}/.config/Claude`;
    return [mcpJsonTarget(`${base}/claude_desktop_config.json`, stdioEntry(env)), rulesTarget(`${base}/AGENTS.md`)];
  },
  manual: () => manualSnippet("claude-desktop", DOCS, false),
});
