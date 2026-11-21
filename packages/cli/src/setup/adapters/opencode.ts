/** Adapter: OpenCode — local config discovered on this machine; schema key "mcp" UNVERIFIED. */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://opencode.ai/docs/mcp";
export default defineAdapter({
  id: "opencode", name: "OpenCode", docsUrl: DOCS, docsVerified: false,
  note: "Config key may be `mcp` rather than `mcpServers`; verify with the manual snippet.",
  detectPaths: { home: [".config/opencode", ".config/opencode/opencode.json"], project: ["opencode.json"] },
  targets(env, scope) {
    return scope === "user"
      ? [mcpJsonTarget(`${env.home}/.config/opencode/opencode.json`, stdioEntry(env), "mcp"), rulesTarget(`${env.home}/.config/opencode/AGENTS.md`)]
      : [mcpJsonTarget(`${env.projectRoot}/opencode.json`, stdioEntry(env), "mcp"), rulesTarget(`${env.projectRoot}/AGENTS.md`)];
  },
  manual: () => manualSnippet("opencode", DOCS, false),
});
