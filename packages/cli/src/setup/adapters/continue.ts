/** Adapter: Continue — config.json/mcpServers UNVERIFIED today; manual snippet included. */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://docs.continue.dev/customize/deep-dives/mcp";
export default defineAdapter({
  id: "continue", name: "Continue", docsUrl: DOCS, docsVerified: false,
  detectPaths: { home: [".continue"], project: [".continue"] },
  targets(env, scope) {
    return scope === "user"
      ? [mcpJsonTarget(`${env.home}/.continue/config.json`, stdioEntry(env)), rulesTarget(`${env.home}/.continue/intent.md`)]
      : [rulesTarget(`${env.projectRoot}/.continue/intent.md`)];
  },
  manual: () => manualSnippet("continue", DOCS, false),
});
