/** Adapter: Amp — config path UNVERIFIED today; manual snippet included. */
import { defineAdapter } from "../factory.js";
import { rulesTarget, manualSnippet } from "../targets.js";

const DOCS = "https://ampcode.com/manual#mcp";
export default defineAdapter({
  id: "amp", name: "Amp", docsUrl: DOCS, docsVerified: false,
  manualOnly: true,
  detectPaths: { home: [".config/amp", ".amp"], project: [".amp"] },
  targets(env, scope) {
    return [rulesTarget(scope === "user" ? `${env.home}/.config/amp/AGENTS.md` : `${env.projectRoot}/AGENTS.md`)];
  },
  manual: () => manualSnippet("amp", DOCS, false),
});
