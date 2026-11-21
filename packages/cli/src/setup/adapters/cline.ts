/** Adapter: Cline — config path UNVERIFIED today; manual snippet included. */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://docs.cline.bot/mcp/configuring-mcp-servers";
export default defineAdapter({
  id: "cline", name: "Cline", docsUrl: DOCS, docsVerified: false,
  detectPaths: { home: [".cline", ".config/Cline"], project: [".cline"] },
  targets(env, scope) {
    return scope === "user"
      ? [mcpJsonTarget(`${env.home}/.cline/mcp_settings.json`, stdioEntry(env)), rulesTarget(`${env.home}/.cline/rules/intent.md`)]
      : [rulesTarget(`${env.projectRoot}/.cline/rules/intent.md`)];
  },
  manual: () => manualSnippet("cline", DOCS, false),
});
