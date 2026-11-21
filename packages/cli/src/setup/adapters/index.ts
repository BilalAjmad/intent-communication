import type { AgentAdapter } from "../types.js";
import claudeCode from "./claude-code.js";
import cursor from "./cursor.js";
import windsurf from "./windsurf.js";
import cline from "./cline.js";
import rooCode from "./roo-code.js";
import kiloCode from "./kilo-code.js";
import codexCli from "./codex-cli.js";
import geminiCli from "./gemini-cli.js";
import githubCopilot from "./github-copilot.js";
import vscodeMcp from "./vscode-mcp.js";
import zed from "./zed.js";
import continueAdapter from "./continue.js";
import opencode from "./opencode.js";
import amp from "./amp.js";
import goose from "./goose.js";
import jetbrainsAi from "./jetbrains-ai.js";
import claudeDesktop from "./claude-desktop.js";

/** All 17 agents, one adapter file each (final master order section D). */
export const ADAPTERS: AgentAdapter[] = [
  claudeCode, cursor, windsurf, cline, rooCode, kiloCode, codexCli, geminiCli, githubCopilot,
  vscodeMcp, zed, continueAdapter, opencode, amp, goose, jetbrainsAi, claudeDesktop,
];

export const ADAPTER_IDS = ADAPTERS.map((a) => a.id);
