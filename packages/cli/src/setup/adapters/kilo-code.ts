/** Adapter: Kilo Code — config path UNVERIFIED today; manual snippet included. */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://kilo.ai/docs/features/mcp";
export default defineAdapter({
  id: "kilo-code", name: "Kilo Code", docsUrl: DOCS, docsVerified: false,
  detectPaths: { home: [".kilo"], project: [".kilo"] },
  targets(env, scope) {
    return scope === "user"
      ? [mcpJsonTarget(`${env.home}/.kilo/mcp_settings.json`, stdioEntry(env)), rulesTarget(`${env.home}/.kilo/rules/intent.md`)]
      : [rulesTarget(`${env.projectRoot}/.kilo/rules/intent.md`)];
  },
  manual: () => manualSnippet("kilo-code", DOCS, false),
});
