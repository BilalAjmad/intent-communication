import { createServer } from "./index.js";

/**
 * Local launcher for the Intent Studio (dev/demo).
 *
 * Starts the server against INTENT_PROJECT_ROOT (default: process.cwd()),
 * picks free ports, writes .intent/runtime.json, and prints the URL with the
 * session token in the URL FRAGMENT (never the query string). Stays alive
 * until Ctrl+C.
 *
 * Usage:
 *   INTENT_PROJECT_ROOT=/path/to/your/app node dist/start.js
 *   # or from a project root:
 *   pnpm --filter @intent/server start
 */

const root = process.env["INTENT_PROJECT_ROOT"] ?? process.cwd();
const server = createServer({ projectRoot: root, previewPort: 0, studioPort: 0, mcpPort: 0 });

server
  .start()
  .then((port: number) => {
    const token = server.getSessionToken();
    console.log(`Intent Studio running at http://127.0.0.1:${port}/#t=${token}`);
    console.log("(.intent/runtime.json also holds the port + token; Ctrl+C to stop)");
    process.on("SIGINT", () => {
      void server.stop().then(() => process.exit(0), () => process.exit(1));
    });
  })
  .catch((err: unknown) => {
    console.error("Failed to start Intent Studio:", err);
    process.exit(1);
  });
