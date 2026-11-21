import { runCLI } from "./index.js";

runCLI().catch((err) => {
  console.error(err);
  process.exit(1);
});

