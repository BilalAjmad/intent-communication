import type { Scope, SetupEnv, SetupTarget } from "./types.js";

export interface AdapterSpec {
  id: string;
  name: string;
  docsUrl: string;
  docsVerified: boolean;
  note?: string;
  manualOnly?: boolean;
  /** Existing paths that indicate this agent is installed (home-relative or project-relative). */
  detectPaths: { home?: string[]; project?: string[] };
  targets(env: SetupEnv, scope: Scope): SetupTarget[];
  manual(): string;
}
