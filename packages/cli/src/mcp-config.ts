import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface IntentMcpCommand {
  command: string;
  args: string[];
}

export interface MergeReport {
  file: string;
  /** true if the file would change (or changed). */
  changed: boolean;
}

/** The command the agent will spawn to launch `intent mcp`. process.execPath
 *  is an absolute node path — correct even on Windows where it contains
 *  spaces — and the args array carries paths as single JSON array elements,
 *  never shell-joined (spaces safe by construction). */
export function defaultIntentCommand(): IntentMcpCommand {
  const cliJs = resolve(dirname(fileURLToPath(import.meta.url)), "cli.js");
  return { command: process.execPath, args: [cliJs, "mcp"] };
}

interface McpJsonFile {
  [key: string]: unknown;
  mcpServers?: unknown;
}

async function mergeServerIntoFile(
  file: string,
  entry: Record<string, unknown>,
  dryRun: boolean,
): Promise<MergeReport> {
  let raw: string | null = null;
  try {
    raw = await fs.readFile(file, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  let parsed: McpJsonFile = {};
  if (raw !== null) {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new Error(
        `${file}: existing file is not valid JSON; refusing to overwrite it. Fix or remove it, then re-run init.`,
      );
    }
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      throw new Error(`${file}: expected a top-level JSON object; refusing to overwrite it.`);
    }
    parsed = json as McpJsonFile;
  }

  if (
    parsed.mcpServers !== undefined &&
    (typeof parsed.mcpServers !== "object" || parsed.mcpServers === null || Array.isArray(parsed.mcpServers))
  ) {
    throw new Error(`${file}: "mcpServers" must be a JSON object; refusing to overwrite it.`);
  }

  // Keep every other server untouched; replace only the "intent" entry.
  const existingServers = (parsed.mcpServers ?? {}) as Record<string, unknown>;
  const mergedServers = { ...existingServers, intent: entry };
  const merged: McpJsonFile = { ...parsed, mcpServers: mergedServers };

  const changed = raw === null || JSON.stringify(merged) !== JSON.stringify(parsed);
  if (!dryRun && changed) {
    await fs.mkdir(dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(merged, null, 2) + "\n", "utf-8");
  }
  return { file, changed };
}

export interface MergeAgentMcpOptions {
  /** Print the plan instead of writing (trd 14.3: --dry-run writes nothing). */
  dryRun: boolean;
  /** Injected for tests; production uses defaultIntentCommand(). */
  intentCommand?: IntentMcpCommand;
}

/**
 * Merge the "intent" server into the two agent configs:
 *  - .mcp.json        Claude Code project scope (an entry with no `type` is
 *                     read as stdio — https://code.claude.com/docs/en/mcp)
 *  - .cursor/mcp.json Cursor project config ("type": "stdio" required —
 *                     https://cursor.com/docs/context/mcp)
 * Idempotent; other servers preserved; only the "intent" entry is changed.
 */
export async function mergeAgentMcpConfigs(
  projectRoot: string,
  options: MergeAgentMcpOptions,
): Promise<MergeReport[]> {
  const cmd = options.intentCommand ?? defaultIntentCommand();
  const claudeEntry = { command: cmd.command, args: cmd.args };
  const cursorEntry = { type: "stdio", command: cmd.command, args: cmd.args };
  return [
    await mergeServerIntoFile(resolve(projectRoot, ".mcp.json"), claudeEntry, options.dryRun),
    await mergeServerIntoFile(resolve(projectRoot, ".cursor", "mcp.json"), cursorEntry, options.dryRun),
  ];
}
