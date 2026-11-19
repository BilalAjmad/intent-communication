import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeAtomic } from "@intent/core";

export interface IntentMcpCommand {
  command: string;
  args: string[];
}

export interface MergeReport {
  file: string;
  /** true if the file would change (or changed). */
  changed: boolean;
}

/** Resolve `import.meta.url` → path, or null when running inside the single-file bundle
 *  (esbuild's CJS output leaves `import.meta` undefined). */
function importMetaPath(): string | null {
  try {
    return fileURLToPath(import.meta.url);
  } catch {
    return null;
  }
}

/** The command the agent will spawn to launch `intent mcp`. process.execPath
 *  is an absolute node path — correct even on Windows where it contains
 *  spaces — and the args array carries paths as single JSON array elements,
 *  never shell-joined (spaces safe by construction). */
export function defaultIntentCommand(): IntentMcpCommand {
  // Single-file bundle (global install): the bundle itself IS the CLI — point
  // the MCP spawn at argv[1], not at a cli.js that doesn't exist there.
  const bundlePath = importMetaPath() === null ? process.argv[1] : null;
  const cliJs = bundlePath ?? resolve(dirname(importMetaPath() as string), "cli.js");
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
    const st = await fs.lstat(file).catch(() => null);
    if (st?.isSymbolicLink()) {
      throw new Error(`${file}: file is a symlink — refusing to edit it`);
    }
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
    await writeAtomic(file, JSON.stringify(merged, null, 2) + "\n");
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
