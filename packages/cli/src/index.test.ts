import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initCommand, doctorCommand, exportCommand, createCLI } from "./index";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

describe("CLI package", () => {
  const testDir = require("os").tmpdir() + "/.test-cli";

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
      expect(program.version()).toBe("0.1.0");
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
});