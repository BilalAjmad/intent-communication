import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateSkillFiles, SKILL_FILES } from "./index";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

describe("Skills package", () => {
  const testDir = "H:\\intent-communication\\.test-skills";
  const outputDir = resolve(testDir, ".intent", "rules");

  beforeEach(async () => {
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe("SKILL_FILES", () => {
    it("has 4 canonical files", () => {
      expect(SKILL_FILES.length).toBe(4);
    });

    it("includes all required files", () => {
      const names = SKILL_FILES.map((f) => f.name);
      expect(names).toContain("intent-core.md");
      expect(names).toContain("tool-usage.md");
      expect(names).toContain("design-principles.md");
      expect(names).toContain("studio.md");
    });

    it("each file has content and description", () => {
      for (const file of SKILL_FILES) {
        expect(file.content).toBeDefined();
        expect(file.content.length).toBeGreaterThan(0);
        expect(file.description).toBeDefined();
      }
    });
  });

  describe("generateSkillFiles", () => {
    it("creates all 4 files in output directory", async () => {
      await generateSkillFiles({ projectRoot: testDir, outputDir });

      for (const file of SKILL_FILES) {
        const filePath = resolve(outputDir, file.name);
        const content = await fs.readFile(filePath, "utf-8");
        expect(content).toBe(file.content);
      }
    });

    it("uses default output dir when not specified", async () => {
      await generateSkillFiles({ projectRoot: testDir });
      const defaultDir = resolve(testDir, ".intent", "rules");

      for (const file of SKILL_FILES) {
        const filePath = resolve(defaultDir, file.name);
        const content = await fs.readFile(filePath, "utf-8");
        expect(content).toBe(file.content);
      }
    });
  });

  describe("Content verification", () => {
    it("intent-core.md contains interview flow", async () => {
      await generateSkillFiles({ projectRoot: testDir, outputDir });
      const content = await fs.readFile(resolve(outputDir, "intent-core.md"), "utf-8");
      expect(content).toContain("Always active");
      expect(content).toContain("Meter-driven");
      expect(content).toContain("Profile derivation");
      expect(content).toContain("Brief emission");
    });

    it("tool-usage.md lists all 6 tools", async () => {
      await generateSkillFiles({ projectRoot: testDir, outputDir });
      const content = await fs.readFile(resolve(outputDir, "tool-usage.md"), "utf-8");
      expect(content).toContain("get_scene");
      expect(content).toContain("apply_patch");
      expect(content).toContain("get_feedback");
      expect(content).toContain("ask_user");
      expect(content).toContain("open_studio");
      expect(content).toContain("read_config");
    });

    it("design-principles.md contains token system", async () => {
      await generateSkillFiles({ projectRoot: testDir, outputDir });
      const content = await fs.readFile(resolve(outputDir, "design-principles.md"), "utf-8");
      expect(content).toContain("token.color.primary");
      expect(content).toContain("token.spacing.md");
      expect(content).toContain("token.typography.fontSize.md");
      expect(content).toContain("WCAG AA");
    });

    it("studio.md contains keyboard shortcuts", async () => {
      await generateSkillFiles({ projectRoot: testDir, outputDir });
      const content = await fs.readFile(resolve(outputDir, "studio.md"), "utf-8");
      expect(content).toContain("V | Select tool");
      expect(content).toContain("R | Rectangle tool");
      expect(content).toContain("Ctrl+Z | Undo");
    });
  });
});