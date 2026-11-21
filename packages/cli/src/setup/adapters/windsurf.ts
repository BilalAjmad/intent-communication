/** Adapter: Windsurf — config path UNVERIFIED today; manual snippet included. */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://docs.windsurf.com/windsurf/cascade/mcp";
export default defineAdapter({
  id: "windsurf", name: "Windsurf", docsUrl: DOCS, docsVerified: false,
  note: "MCP path is version-dependent; verify with the manual snippet if the config do not load.",
  detectPaths: { home: [".codeium/windsurf"], project: [".windsurf"] },
  targets(env, scope) {
    return scope === "user"
      ? [mcpJsonTarget(`${env.home}/.codeium/windsurf/mcp_config.json`, stdioEntry(env)), rulesTarget(`${env.home}/.codeium/windsurf/rules/intent.md`)]
      : [rulesTarget(`${env.projectRoot}/.windsurf/rules/intent.md`)];
  },
  manual: () => manualSnippet("windsurf", DOCS, false),
});
