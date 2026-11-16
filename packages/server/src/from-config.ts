import { IntentServer } from "./index.js";
import type { Config } from "@intent/schema";

/** Builds a server from the parsed .intent/config.json (used by tools that load config once). */
export function createServerFromConfig(projectRoot: string, config: Config): IntentServer {
  return new IntentServer({
    projectRoot,
    previewPort: config.previewPort,
    studioPort: config.studioPort,
    mcpPort: config.mcpPort,
  });
}
