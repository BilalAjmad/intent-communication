/** Adapter: Zed — settings.json uses context_servers (UNVERIFIED today); manual snippet only. */
import { defineAdapter } from "../factory.js";
import { rulesTarget, manualSnippet } from "../targets.js";

const DOCS = "https://zed.dev/docs/ai/mcp";
export default defineAdapter({
  id: "zed", name: "Zed", docsUrl: DOCS, docsVerified: false,
  manualOnly: true, note: "Zed uses context_servers, not mcpServers; apply the manual snippet.",
  detectPaths: { home: [".config/zed"], project: [".zed"] },
  targets(env, scope) {
    return [rulesTarget(scope === "user" ? `${env.home}/.config/zed/intent.md` : `${env.projectRoot}/.zed/intent.md`)];
  },
  manual: () => manualSnippet("zed", DOCS, false),
});
