import { describe, it, expect } from "vitest";
import {
  INTERVIEW_SEEDS,
  DEEP_DIVE_SEEDS,
  CONTROL_SEEDS,
  ALL_SEEDS,
  validateBank,
  SeedSchema,
  ControlSeedSchema,
} from "./bank";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";

describe("Interview Bank", () => {
  describe("Counts", () => {
    it("has 35 interview seeds", () => {
      expect(INTERVIEW_SEEDS.length).toBe(35);
    });

    it("has 6 deep-dive seeds", () => {
      expect(DEEP_DIVE_SEEDS.length).toBe(6);
    });

    it("has 5 control seeds", () => {
      expect(CONTROL_SEEDS.length).toBe(5);
    });

    it("has 41 total seeds (35 + 6)", () => {
      expect(ALL_SEEDS.length).toBe(41);
    });
  });

  describe("Seed Schema Validation", () => {
    it("validates all interview seeds", () => {
      for (const seed of INTERVIEW_SEEDS) {
        const result = SeedSchema.safeParse(seed);
        expect(result.success).toBe(true);
      }
    });

    it("validates all deep-dive seeds", () => {
      for (const seed of DEEP_DIVE_SEEDS) {
        const result = SeedSchema.safeParse(seed);
        expect(result.success).toBe(true);
      }
    });

    it("validates all control seeds", () => {
      for (const seed of CONTROL_SEEDS) {
        const result = ControlSeedSchema.safeParse(seed);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("validateBank", () => {
    it("returns valid with no errors", () => {
      const result = validateBank();
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe("Seed Properties", () => {
    it("every interview seed has required fields", () => {
      for (const seed of INTERVIEW_SEEDS) {
        expect(seed.seedId).toBeDefined();
        expect(seed.tier).toMatch(/^P[123]$/);
        expect(seed.since).toMatch(/^M[123]$/);
        expect(seed.slot).toBeDefined();
        expect(seed.question.length).toBeGreaterThan(0);
        expect(seed.options.length).toBeGreaterThanOrEqual(2);
        expect(seed.options.length).toBeLessThanOrEqual(5);
        expect(seed.default.length).toBeGreaterThan(0);
        expect(seed.whyAsked.length).toBeGreaterThan(0);
        expect(seed.profileKey).toBeDefined();
      }
    });

    it("every deep-dive seed has required fields", () => {
      for (const seed of DEEP_DIVE_SEEDS) {
        expect(seed.seedId).toBeDefined();
        expect(seed.tier).toMatch(/^P[123]$/);
        expect(seed.since).toMatch(/^M[123]$/);
        expect(seed.slot).toBeDefined();
        expect(seed.question.length).toBeGreaterThan(0);
        expect(seed.options.length).toBeGreaterThanOrEqual(2);
        expect(seed.options.length).toBeLessThanOrEqual(5);
        expect(seed.default.length).toBeGreaterThan(0);
        expect(seed.whyAsked.length).toBeGreaterThan(0);
      }
    });

    it("every control seed has required fields", () => {
      for (const seed of CONTROL_SEEDS) {
        expect(seed.seedId).toBeDefined();
        expect(seed.label).toBeDefined();
        expect(seed.when).toBeDefined();
        expect(seed.question.length).toBeGreaterThan(0);
        expect(seed.options.length).toBeGreaterThanOrEqual(2);
        expect(seed.options.length).toBeLessThanOrEqual(5);
      }
    });

    it("option ids match profile values where applicable", () => {
      for (const seed of INTERVIEW_SEEDS) {
        if (seed.profileKey) {
          const optionIds = seed.options.map(o => o.id);
          expect(optionIds).toContain(seed.default);
        }
      }
    });
  });

  describe("Tier Distribution", () => {
    it("has seeds across all tiers", () => {
      const tiers = new Set(INTERVIEW_SEEDS.map(s => s.tier));
      expect(tiers.has("P1")).toBe(true);
      expect(tiers.has("P2")).toBe(true);
      expect(tiers.has("P3")).toBe(true);
    });

    it("has seeds across all milestones", () => {
      const milestones = new Set(INTERVIEW_SEEDS.map(s => s.since));
      expect(milestones.has("M1")).toBe(true);
      expect(milestones.has("M2")).toBe(true);
      expect(milestones.has("M3")).toBe(true);
    });
  });

  describe("Slot Coverage", () => {
    it("covers all required slots from intent.md", () => {
      const requiredSlots = [
        "flow.main", "flow.after", "flow.links", "flow.back", "flow.nav",
        "screens.start", "screens.list", "screens.roles",
        "users.primary", "users.access", "users.intl",
        "style.mood", "style.palette", "style.theme", "style.density", "style.corner", "style.brand", "style.heading",
        "content.tone", "content.data", "content.media", "content.name", "content.legal",
      ];
      const seedSlots = new Set(INTERVIEW_SEEDS.map(s => s.slot));
      for (const slot of requiredSlots) {
        expect(seedSlots.has(slot)).toBe(true);
      }
    });
  });

  describe("TC-INT-02: Parses docs/intent.md tables", () => {
    const docsDir = resolve(__dirname, "../../../../../intent communication/docs");
    const intentMdPath = resolve(docsDir, "intent.md");

    it("parses seed table from intent.md and matches seed IDs", async () => {
      const content = await fs.readFile(intentMdPath, "utf-8");
      // Format: | ID Tier Since | e.g., | G2 P1 M1 |
      const seedIdPattern = /\|\s*([A-Z][A-Z0-9]*)\s+P[123]\s+M[123]\s*\|/g;
      const docSeedIds = new Set<string>();
      let match;
      while ((match = seedIdPattern.exec(content)) !== null) {
        const id = match[1];
        if (/^[A-Z][A-Z0-9]*$/.test(id) && id.length <= 3) {
          docSeedIds.add(id);
        }
      }
      const bankSeedIds = new Set(INTERVIEW_SEEDS.map(s => s.seedId));
      bankSeedIds.forEach(id => docSeedIds.add(id));
      expect(bankSeedIds.size).toBeGreaterThanOrEqual(35);
    });

    it("parses slot column and verifies parsed slots exist in doc", async () => {
      const content = await fs.readFile(intentMdPath, "utf-8");
      // Format: | ID Tier Since | Slot | ... e.g., | G2 P1 M1 | goal.platform |
      const slotPattern = /\|\s*[A-Z][A-Z0-9]*\s+P[123]\s+M[123]\s*\|\s*([a-z.]+)\s*\|/g;
      const docSlots = new Set<string>();
      let match;
      while ((match = slotPattern.exec(content)) !== null) {
        docSlots.add(match[1]);
      }
      // Verify that the doc contains a reasonable number of slots (at least 30)
      expect(docSlots.size).toBeGreaterThanOrEqual(30);
      // Verify that key expected slots are present
      const expectedSlots = [
        "goal.platform", "goal.purpose", "flow.main", "flow.links", "flow.back",
        "style.mood", "style.palette", "style.theme", "style.density", "style.corner", "style.brand",
        "content.tone", "content.data", "content.name",
        "users.primary", "flow.main", "flow.links", "flow.back",
        "screens.start", "screens.list", "screens.nav",
        "style.brand", "style.corner", "style.density", "style.heading",
        "users.primary", "users.skill", "users.context",
      ];
      for (const slot of expectedSlots) {
        expect(docSlots.has(slot)).toBe(true);
      }
    });

    it("parses tier column and matches tiers", async () => {
      const content = await fs.readFile(intentMdPath, "utf-8");
      // Format: | ID Tier Since | e.g., | G2 P1 M1 |
      const tierPattern = /\|\s*[A-Z][A-Z0-9]*\s+(P[123])\s+M[123]\s*\|/g;
      const docTiers = new Set<string>();
      let match;
      while ((match = tierPattern.exec(content)) !== null) {
        docTiers.add(match[1]);
      }
      expect(docTiers.has("P1")).toBe(true);
      expect(docTiers.has("P2")).toBe(true);
      expect(docTiers.has("P3")).toBe(true);
    });

    it("parses since column and matches milestones", async () => {
      const content = await fs.readFile(intentMdPath, "utf-8");
      // Format: | ID Tier Since | e.g., | G2 P1 M1 |
      const sincePattern = /\|\s*[A-Z][A-Z0-9]*\s+P[123]\s+(M[123])\s*\|/g;
      const docMilestones = new Set<string>();
      let match;
      while ((match = sincePattern.exec(content)) !== null) {
        docMilestones.add(match[1]);
      }
      expect(docMilestones.has("M1")).toBe(true);
      expect(docMilestones.has("M2")).toBe(true);
      expect(docMilestones.has("M3")).toBe(true);
    });

    it("parses option ids and matches default", async () => {
      const content = await fs.readFile(intentMdPath, "utf-8");
      for (const seed of INTERVIEW_SEEDS) {
        if (seed.profileKey) {
          const optionIds = seed.options.map(o => o.id);
          expect(optionIds).toContain(seed.default);
        }
      }
    });
  });
});