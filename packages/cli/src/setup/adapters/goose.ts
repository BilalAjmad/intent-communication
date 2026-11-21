/** Adapter: Goose — YAML config; automatic merge not attempted (UNVERIFIED format). */
import { defineAdapter } from "../factory.js";
import { rulesTarget, manualSnippet } from "../targets.js";

const DOCS = "https://block.github.io/goose/docs/guides/using-mcp-servers/";
export default defineAdapter({
  id: "goose", name: "Goose", docsUrl: DOCS, docsVerified: false,
  manualOnly: true, note: "config.yaml needs YAML-aware editing; use the manual snippet.",
  detectPaths: { home: [".config/goose"], project: [".goose"] },
  targets(env, scope) {
    return [rulesTarget(scope === "user" ? `${env.home}/.config/goose/AGENTS.md` : `${env.projectRoot}/AGENTS.md`)];
  },
  manual: () => manualSnippet("goose", DOCS, false),
});
