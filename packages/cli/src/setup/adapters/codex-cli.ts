/** Adapter: Codex CLI — TOML config; automatic merge is NOT attempted (UNVERIFIED format). */
import { defineAdapter } from "../factory.js";
import { rulesTarget, manualSnippet } from "../targets.js";

const DOCS = "https://developers.openai.com/codex/mcp/";
export default defineAdapter({
  id: "codex-cli", name: "Codex CLI", docsUrl: DOCS, docsVerified: false,
  manualOnly: true, note: "config.toml needs a TOML-aware edit; a manual snippet is shown instead of guessing.",
  detectPaths: { home: [".codex"], project: [".codex"] },
  targets(env, scope) {
    return [rulesTarget(scope === "user" ? `${env.home}/.codex/AGENTS.md` : `${env.projectRoot}/AGENTS.md`)];
  },
  manual: () => manualSnippet("codex-cli", DOCS, false),
});
