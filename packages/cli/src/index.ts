import { Command } from "commander";
import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import ora from "ora";
import {
  createFileStoragePort,
  createFileLockPort,
  createNodeCryptoPort,
} from "@intent/adapters-node";
import { exportToHtml, exportSceneToFile } from "@intent/engine";
import { generateAllSkillFiles } from "@intent/skills";
import { Scene, Config } from "@intent/schema";
import { validateScene } from "@intent/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CLIContext {
  projectRoot: string;
  storage: ReturnType<typeof createFileStoragePort>;
  lockPort: ReturnType<typeof createFileLockPort>;
  crypto: ReturnType<typeof createNodeCryptoPort>;
}

function createContext(projectRoot: string): CLIContext {
  return {
    projectRoot,
    storage: createFileStoragePort(projectRoot),
    lockPort: createFileLockPort(createFileStoragePort(projectRoot)),
    crypto: createNodeCryptoPort(),
  };
}

async function initCommand(projectRoot: string): Promise<void> {
  const spinner = ora("Initializing Intent project...").start();
  const intentDir = resolve(projectRoot, ".intent");
  const scenesDir = resolve(intentDir, "scenes");
  const locksDir = resolve(intentDir, "locks");
  const briefsDir = resolve(intentDir, "briefs");
  const feedbackDir = resolve(intentDir, "feedback");
  const interviewDir = resolve(intentDir, "interview");

  await fs.mkdir(scenesDir, { recursive: true });
  await fs.mkdir(locksDir, { recursive: true });
  await fs.mkdir(briefsDir, { recursive: true });
  await fs.mkdir(feedbackDir, { recursive: true });
  await fs.mkdir(interviewDir, { recursive: true });

  // Default config
  const configPath = resolve(intentDir, "config.json");
  const defaultConfig = {
    version: 1,
    projectName: "Intent Project",
    previewPort: 3456,
    studioPort: 3457,
    mcpPort: 3458,
    maxBytes: 32768,
    autoSave: true,
    lockTTL: 30000,
  };
  await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));

  // Generate skill files
  await import("@intent/skills").then((m) => m.generateAllSkillFiles(projectRoot));

  // Create default scene
  const defaultScene = {
    version: 1,
    revision: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    screens: {},
    objects: {},
    screenOrder: [],
    metadata: { name: "Untitled Project", tags: [] },
  };
  const scenePath = resolve(scenesDir, "default.json");
  await fs.writeFile(scenePath, JSON.stringify(defaultScene, null, 2));

  spinner.succeed(chalk.green("Intent project initialized"));
  console.log(chalk.gray(`  Project root: ${projectRoot}`));
  console.log(chalk.gray(`  Config: ${configPath}`));
  console.log(chalk.gray(`  Default scene: ${scenePath}`));
  console.log(chalk.gray(`  Skill rules: ${resolve(projectRoot, ".intent", "rules")}`));
}

async function doctorCommand(projectRoot: string): Promise<void> {
  const spinner = ora("Running diagnostics...").start();
  const issues: string[] = [];
  const warnings: string[] = [];

  const intentDir = resolve(projectRoot, ".intent");
  const configPath = resolve(intentDir, "config.json");
  const scenesDir = resolve(intentDir, "scenes");
  const rulesDir = resolve(intentDir, "rules");

  // Check .intent directory
  try {
    await fs.access(intentDir);
  } catch {
    issues.push(".intent directory not found — run 'intent init'");
    spinner.fail(chalk.red("Diagnostics failed"));
    printResults(issues, warnings);
    return;
  }

  // Check config
  try {
    const configContent = await fs.readFile(configPath, "utf-8");
    const config = JSON.parse(configContent);
    if (config.version !== 1) {
      warnings.push(`Config version is ${config.version}, expected 1`);
    }
  } catch {
    issues.push("config.json missing or invalid");
  }

  // Check scenes
  try {
    const scenes = await fs.readdir(scenesDir);
    if (scenes.length === 0) {
      warnings.push("No scenes found");
    }
  } catch {
    issues.push("Scenes directory not accessible");
  }

  // Check skill rules
  try {
    const rules = await fs.readdir(rulesDir);
    const required = ["intent-core.md", "tool-usage.md", "design-principles.md", "studio.md"];
    for (const req of required) {
      if (!rules.includes(req)) {
        warnings.push(`Missing skill rule: ${req}`);
      }
    }
  } catch {
    warnings.push("Skill rules directory not found — run 'intent init' to regenerate");
  }

  // Check Node.js version
  const nodeVersion = process.version;
  const versionParts = nodeVersion.slice(1).split(".");
  const major = parseInt(versionParts[0] || "0", 10);
  if (major < 20) {
    warnings.push(`Node.js ${nodeVersion} — recommend >=20`);
  }

  spinner.succeed(chalk.green("Diagnostics complete"));
  printResults(issues, warnings);
}

function printResults(issues: string[], warnings: string[]): void {
  if (issues.length > 0) {
    console.log(chalk.red("\nIssues:"));
    for (const issue of issues) console.log(chalk.red(`  ✗ ${issue}`));
  }
  if (warnings.length > 0) {
    console.log(chalk.yellow("\nWarnings:"));
    for (const warn of warnings) console.log(chalk.yellow(`  ⚠ ${warn}`));
  }
  if (issues.length === 0 && warnings.length === 0) {
    console.log(chalk.green("\nAll checks passed!"));
  }
}

async function exportCommand(projectRoot: string, options: { scene?: string; output?: string; format?: string }): Promise<void> {
  const spinner = ora("Exporting scene...").start();

  const sceneId = options.scene || "default";
  const storage = createFileStoragePort(projectRoot);
  const scene = await storage.readScene(sceneId);

  if (!scene) {
    spinner.fail(chalk.red(`Scene '${sceneId}' not found`));
    return;
  }

  const outputPath = options.output || resolve(projectRoot, `export-${sceneId}.html`);
  const format = options.format || "html";

  if (format === "html") {
    exportSceneToFile(scene, outputPath, {
      includeStyles: true,
      includeScripts: true,
      inlineAssets: true,
    });
    spinner.succeed(chalk.green(`Exported to ${outputPath}`));
  } else {
    spinner.fail(chalk.red(`Unsupported format: ${format}`));
  }
}

export function createCLI(): Command {
  const program = new Command();

  program
    .name("intent")
    .description("Intent — browser-first SPA monorepo for closing the intent gap")
    .version("0.1.0")
    .option("-p, --path <path>", "Project root path", process.cwd());

  program
    .command("init")
    .description("Initialize a new Intent project in the current directory")
    .action(async () => {
      await initCommand(resolve(program.opts()["path"] as string));
    });

  program
    .command("doctor")
    .description("Run diagnostics on the Intent project")
    .action(async () => {
      await doctorCommand(resolve(program.opts()["path"] as string));
    });

  program
    .command("export")
    .description("Export a scene to HTML")
    .option("-s, --scene <sceneId>", "Scene ID to export", "default")
    .option("-o, --output <path>", "Output file path")
    .option("-f, --format <format>", "Export format (html)", "html")
    .action(async (options) => {
      await exportCommand(resolve(program.opts()["path"] as string), {
        scene: options.scene,
        output: options.output ? resolve(options.output) : undefined,
        format: options.format,
      });
    });

  return program;
}

export async function runCLI(args: string[] = process.argv): Promise<void> {
  const program = createCLI();
  await program.parseAsync(args);
}

export { initCommand, doctorCommand, exportCommand };
export type { CLIContext };