/** Adapter: Roo Code — config path UNVERIFIED today; manual snippet included. */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://docs.roocode.com/features/mcp/using-mcp-in-roo";
export default defineAdapter({
  id: "roo-code", name: "Roo Code", docsUrl: DOCS, docsVerified: false,
  detectPaths: { home: [".roo"], project: [".roo"] },
  targets(env, scope) {
    return scope === "user"
      ? [mcpJsonTarget(`${env.home}/.roo/mcp_settings.json`, stdioEntry(env)), rulesTarget(`${env.home}/.roo/rules/intent.md`)]
      : [rulesTarget(`${env.projectRoot}/.roo/rules/intent.md`)];
  },
  manual: () => manualSnippet("roo-code", DOCS, false),
});
