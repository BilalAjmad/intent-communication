import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { defaultIntentCommand } from "./mcp-config.js";
import { ADAPTERS, ADAPTER_IDS } from "./setup/adapters/index.js";
import { applySetup, detectAdapters, statusLabel } from "./setup/engine.js";
import type { Scope, SetupEnv } from "./setup/types.js";

export interface SetupOptions {
  yes?: boolean;
  all?: boolean;
  agents?: string;
  scope?: string;
  dryRun?: boolean;
  uninstall?: boolean;
}

function parseScope(value: string | undefined): Scope {
  return value === "user" ? "user" : "project";
}

/** One-question-per-agent checklist. Returns the ids the user accepted. */
async function checklist(
  detected: { agent: string; name: string; detected: boolean }[],
  preselect: string[],
): Promise<string[]> {
  if (!input.isTTY) return preselect;
  const rl = createInterface({ input, output });
  const chosen: string[] = [];
  try {
    for (const row of detected) {
      const hint = row.detected ? "detected" : "not detected";
      const def = preselect.includes(row.agent) ? "Y" : "y/N";
      const answer = (await rl.question(`Configure ${row.name} (${row.agent}) [${hint}]? [${def}] `)).trim().toLowerCase();
      if (answer === "y" || answer === "yes" || (answer === "" && preselect.includes(row.agent))) chosen.push(row.agent);
    }
  } finally {
    rl.close();
  }
  return chosen;
}

export async function runSetup(projectRoot: string, options: SetupOptions): Promise<void> {
  const explicit = options.agents?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const unknown = explicit.filter((id) => !ADAPTER_IDS.includes(id));
  if (unknown.length > 0) {
    console.error(chalk.red(`Unknown agent id(s): ${unknown.join(", ")}. Known: ${ADAPTER_IDS.join(", ")}`));
    process.exitCode = 1;
    return;
  }
  const scope = parseScope(options.scope);
  const env: SetupEnv = {
    home: homedir(),
    projectRoot: resolve(projectRoot),
    platform: process.platform,
    intentCommand: defaultIntentCommand(),
  };
  const detected = await detectAdapters(ADAPTERS, env, scope);
  const preselect = options.all ? [...ADAPTER_IDS] : explicit.length > 0 ? explicit : detected.filter((d) => d.detected).map((d) => d.agent);
  const selected = options.yes === true || explicit.length > 0 || !input.isTTY ? preselect : await checklist(detected, preselect);

  if (options.dryRun === true) console.log(chalk.bold("DRY RUN — no files will be written"));

  const results = await applySetup({
    env, scope, adapters: ADAPTERS, selected, dryRun: options.dryRun === true,
    uninstall: options.uninstall === true, all: options.all === true,
  });

  console.log("");
  console.log(chalk.bold(`Intent setup — scope ${scope}${options.uninstall ? " (uninstall)" : ""}`));
  console.log(chalk.gray("Agent".padEnd(20) + "Status".padEnd(24) + "Config paths"));
  for (const r of results) {
    console.log(chalk.gray(r.agent.padEnd(20) + statusLabel(r.status).padEnd(24) + (r.paths[0] ?? "-")));
    if (r.note) console.log(chalk.yellow(`  ${r.note}`));
  }
  const errors = results.filter((r) => r.status === "error");
  if (errors.length > 0) process.exitCode = 1;

  const manualIds = results.filter((r) => r.status === "manual").map((r) => r.agent);
  if (!options.uninstall && manualIds.length > 0) {
    console.log("");
    console.log(chalk.bold("Manual snippets (no automatic file edit was attempted):"));
    for (const id of manualIds) {
      const adapter = ADAPTERS.find((a) => a.id === id);
      if (adapter) console.log(`\n--- ${adapter.name} ---\n${adapter.manual()}`);
    }
  }
  if (!options.uninstall && results.length === 0) {
    console.log(chalk.yellow("No agents selected. Use --agents <ids> or --all, or run `intent init` in a project."));
  }
}

/** Register the command with the CLI (kept separate so index.ts stays under 500 lines). */
export function registerSetupCommand(program: Command): void {
  program
    .command("setup")
    .description("Register Intent with installed coding agents (MCP + slash commands + rules)")
    .option("--yes", "Accept the preselected agents without prompting")
    .option("--all", "Select all known agents, even undetected ones")
    .option("--agents <ids>", "Comma-separated agent ids")
    .option("--scope <scope>", "user or project (default: project)")
    .option("--dry-run", "Print the plan; write nothing")
    .option("--uninstall", "Remove only Intent's entries/blocks from agent configs")
    .action(async (options: SetupOptions) => {
      await runSetup(resolve((program.opts()["path"] as string) ?? process.cwd()), options);
    });
}
