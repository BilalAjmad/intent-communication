import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initCommand, doctorCommand, createCLI, exportCommand } from "./index";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

describe("CLI package", () => {
  const testDir = tmpdir() + "/.test-cli";

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("createCLI", () => {
    it("creates CLI program with correct name and version", () => {
      const program = createCLI();
      expect(program.name()).toBe("intent");
      expect(program.version()).toBe("1.0.0");
    });

    it("has init command", () => {
      const program = createCLI();
      const initCmd = program.commands.find((c) => c.name() === "init");
      expect(initCmd).toBeDefined();
      expect(initCmd?.description()).toContain("Initialize");
    });

    it("has doctor command", () => {
      const program = createCLI();
      const doctorCmd = program.commands.find((c) => c.name() === "doctor");
      expect(doctorCmd).toBeDefined();
      expect(doctorCmd?.description()).toContain("diagnostics");
    });

    it("has export command", () => {
      const program = createCLI();
      const exportCmd = program.commands.find((c) => c.name() === "export");
      expect(exportCmd).toBeDefined();
      expect(exportCmd?.description()).toContain("Export");
    });
  });

  describe("initCommand", () => {
    it("creates .intent directory structure", async () => {
      await initCommand(testDir);

      const intentDir = resolve(testDir, ".intent");
      expect(await fs.access(intentDir).then(() => true).catch(() => false)).toBe(true);

      const scenesDir = resolve(testDir, ".intent", "scenes");
      expect(await fs.access(scenesDir).then(() => true).catch(() => false)).toBe(true);

      const locksDir = resolve(testDir, ".intent", "locks");
      expect(await fs.access(locksDir).then(() => true).catch(() => false)).toBe(true);

      const briefsDir = resolve(testDir, ".intent", "briefs");
      expect(await fs.access(briefsDir).then(() => true).catch(() => false)).toBe(true);

      const feedbackDir = resolve(testDir, ".intent", "feedback");
      expect(await fs.access(feedbackDir).then(() => true).catch(() => false)).toBe(true);

      const interviewDir = resolve(testDir, ".intent", "interview");
      expect(await fs.access(interviewDir).then(() => true).catch(() => false)).toBe(true);
    });

    it("creates default config.json", async () => {
      await initCommand(testDir);
      const configPath = resolve(testDir, ".intent", "config.json");
      const content = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      expect(config.version).toBe(1);
      expect(config.projectName).toBe("Intent Project");
      expect(config.previewPort).toBe(3456);
    });

    it("creates default scene", async () => {
      await initCommand(testDir);
      const scenePath = resolve(testDir, ".intent", "scenes", "default.json");
      const content = await fs.readFile(scenePath, "utf-8");
      const scene = JSON.parse(content);
      expect(scene.version).toBe(1);
      expect(scene.revision).toBe(0);
    });

    it("generates skill files", async () => {
      await initCommand(testDir);
      const rulesDir = resolve(testDir, ".intent", "rules");
      const files = await fs.readdir(rulesDir);
      expect(files).toContain("intent-core.md");
      expect(files).toContain("tool-usage.md");
      expect(files).toContain("design-principles.md");
      expect(files).toContain("studio.md");
    });
  });

  describe("doctorCommand", () => {
    it("reports missing .intent directory", async () => {
      const emptyDir = resolve(testDir, "empty");
      await fs.mkdir(emptyDir, { recursive: true });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await doctorCommand(emptyDir);
      consoleSpy.mockRestore();
    });
  });

  describe("exportCommand", () => {
    const SCREEN_ID = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const TEXT_ID = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const scene = {
      version: 1,
      revision: 0,
      createdAt: "2026-11-16T00:00:00.000Z",
      updatedAt: "2026-11-16T00:00:00.000Z",
      screens: {
        [SCREEN_ID]: {
          id: SCREEN_ID, type: "screen", parentId: null, children: [TEXT_ID],
          props: { title: "Home", width: 1280, height: 720 },
          style: {}, meta: {},
        },
      },
      objects: {
        [SCREEN_ID]: {
          id: SCREEN_ID, type: "screen", parentId: null, children: [TEXT_ID],
          props: { title: "Home", width: 1280, height: 720 },
          style: {}, meta: {},
        },
        [TEXT_ID]: {
          id: TEXT_ID, type: "text", parentId: SCREEN_ID, children: [],
          props: { content: "Hello", fontSize: 16 },
          style: {}, meta: {},
          responsive: { sm: { style: { padding: "8px" } } },
        },
      },
      screenOrder: [SCREEN_ID],
      metadata: { name: "Export Test", tags: [] },
    };

    async function seedScene(dir: string, name: string = "default"): Promise<void> {
      const scenesDir = resolve(dir, ".intent", "scenes");
      await fs.mkdir(scenesDir, { recursive: true });
      await fs.writeFile(resolve(scenesDir, `${name}.json`), JSON.stringify(scene), "utf8");
    }

    it("exports html to a file", async () => {
      await seedScene(testDir);
      const out = resolve(testDir, "out.html");
      const prevExit = process.exitCode;
      await exportCommand(testDir, { scene: "default", output: out, format: "html" });
      expect(process.exitCode ?? 0).toBe(0);
      const html = await fs.readFile(out, "utf8");
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Home");
      process.exitCode = prevExit;
    });

    it("exports react to a directory tree", async () => {
      await seedScene(testDir);
      const outDir = resolve(testDir, "out-react");
      const prevExit = process.exitCode;
      await exportCommand(testDir, { scene: "default", output: outDir, format: "react" });
      expect(process.exitCode ?? 0).toBe(0);
      const app = await fs.readFile(resolve(outDir, "intent-export", "App.tsx"), "utf8");
      expect(app).toContain("export default function App");
      const screenFile = await fs.readFile(resolve(outDir, "intent-export", "screens", "Home.tsx"), "utf8");
      expect(screenFile).toContain("export default function Home");
      const tokens = await fs.readFile(resolve(outDir, "intent-export", "tokens.css"), "utf8");
      expect(tokens).toContain("--intent-color-primary");
      const index = await fs.readFile(resolve(outDir, "intent-export", "index.ts"), "utf8");
      expect(index).toContain('export { default as App }');
      process.exitCode = prevExit;
    });

    it("fails with exitCode 1 for unsupported format", async () => {
      await seedScene(testDir);
      const prevExit = process.exitCode;
      process.exitCode = 0;
      await exportCommand(testDir, { scene: "default", format: "pdf" });
      expect(process.exitCode).toBe(1);
      process.exitCode = prevExit;
    });

    it("fails with exitCode 1 when the scene is missing", async () => {
      await fs.mkdir(resolve(testDir, ".intent", "scenes"), { recursive: true });
      const prevExit = process.exitCode;
      process.exitCode = 0;
      await exportCommand(testDir, { scene: "nope" });
      expect(process.exitCode).toBe(1);
      process.exitCode = prevExit;
    });

    it("passes config.json breakpoints into the exported CSS (trd 4.4)", async () => {
      await seedScene(testDir);
      await fs.writeFile(
        resolve(testDir, ".intent", "config.json"),
        JSON.stringify({ version: 1, breakpoints: { sm: 700, md: 1100, lg: 1500 } }),
        "utf8",
      );
      const out = resolve(testDir, "out.html");
      const prevExit = process.exitCode;
      await exportCommand(testDir, { scene: "default", output: out, format: "html" });
      const html = await fs.readFile(out, "utf8");
      expect(html).toContain("@media (min-width: 700px)");
      expect(html).not.toContain("@media (min-width: 640px)");
      process.exitCode = prevExit;
    });
  });
});