import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import type { AdapterSpec } from "./spec.js";
import type { AgentAdapter, Scope, SetupEnv, SetupTarget } from "./types.js";

/** Shared detection/target logic for a thin per-agent adapter (one file per agent). */
export function defineAdapter(spec: AdapterSpec): AgentAdapter {
  const exists = async (p: string): Promise<boolean> => {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  };

  return {
    id: spec.id,
    name: spec.name,
    docsUrl: spec.docsUrl,
    docsVerified: spec.docsVerified,
    ...(spec.note ? { note: spec.note } : {}),
    ...(spec.manualOnly ? { manualOnly: true } : {}),
    async detect(env: SetupEnv, scope: Scope): Promise<boolean> {
      const paths = (scope === "user" ? spec.detectPaths.home : spec.detectPaths.project) ?? [];
      for (const p of paths) {
        const abs = p.startsWith("~") ? resolve(env.home, p.slice(1)) : resolve(env.projectRoot, p);
        if (await exists(abs)) return true;
      }
      return false;
    },
    targets(env: SetupEnv, scope: Scope): SetupTarget[] {
      return spec.targets(env, scope);
    },
    manual(): string {
      return spec.manual();
    },
  };
}
