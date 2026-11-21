export type Scope = "user" | "project";

export interface SetupEnv {
  home: string;
  projectRoot: string;
  platform: NodeJS.Platform;
  /** Launch command for the MCP server (absolute paths, spaces-safe argv). */
  intentCommand: IntentMcpCommand;
}
export interface IntentMcpCommand {
  command: string;
  args: string[];
}

export type TargetKind = "mcp" | "rules" | "command";

export interface SetupTarget {
  kind: TargetKind;
  path: string;
  /** JSON wrapper key for MCP config files. */
  jsonKey?: string;
  /** Server entry written under jsonKey. */
  entry?: Record<string, unknown>;
  /** Content for rules/command files. */
  content?: string;
  /** Command name for command files (used to remove exactly our two). */
  commandName?: "intent" | "prototype";
}

export interface AgentAdapter {
  id: string;
  name: string;
  docsUrl: string;
  docsVerified: boolean;
  note?: string;
  /** MCP config cannot be merged safely; a manual snippet is required. */
  manualOnly?: boolean;
  detect(env: SetupEnv, scope: Scope): Promise<boolean>;
  targets(env: SetupEnv, scope: Scope): SetupTarget[];
  manual(): string;
}

export type SetupStatus = "configured" | "unchanged" | "manual" | "skipped" | "error";

export interface SetupResult {
  agent: string;
  status: SetupStatus;
  paths: string[];
  note?: string;
}
