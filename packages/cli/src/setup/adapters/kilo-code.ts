/** Adapter: Kilo Code — config path UNVERIFIED today; manual snippet included. */
import { defineAdapter } from "../factory.js";
import { mcpJsonTarget, rulesTarget, commandTargets, manualSnippet, stdioEntry } from "../targets.js";

const DOCS = "https://kilo.ai/docs/features/mcp";
export default defineAdapter({
  id: "kilo-code", name: "Kilo Code", docsUrl: DOCS, docsVerified: false,
  detectPaths: { home: [".kilo"], project: [".kilo"] },
  targets(env, scope) {
    const targets = [];
    if (scope === "user") {
      targets.push(rulesTarget(`${env.home}/.kilo/rules/intent.md`));
      targets.push(...commandTargets(`${env.home}/.config/kilo/commands`));
    } else {
      targets.push(rulesTarget(`${env.projectRoot}/.kilo/rules/intent.md`));
      targets.push(...commandTargets(`${env.projectRoot}/.kilo/commands`));
    }
    return targets;
  },
  manual: () => manualSnippet("kilo-code", DOCS, false),
});
