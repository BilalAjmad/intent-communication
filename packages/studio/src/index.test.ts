import { describe, it, expect, beforeEach } from "vitest";
import { Studio, createStudio } from "./index";

describe("Studio package", () => {
  const config = {
    previewPort: 3456,
    studioPort: 3457,
    mcpPort: 3458,
  };

  describe("createStudio", () => {
    it("creates studio instance", () => {
      const studio = createStudio(config);
      expect(studio).toBeDefined();
    });
  });

  describe("Studio", () => {
    let studio: ReturnType<typeof createStudio>;

    beforeEach(() => {
      studio = createStudio(config);
    });

    it("has initial state", () => {
      const state = studio.getState();
      expect(state.sceneId).toBe("default");
      expect(state.toolMode).toBe("select");
      expect(state.selectedObjectId).toBeNull();
      expect(state.historyIndex).toBe(-1);
    });

    it("can set tool mode", () => {
      studio.setToolMode("rectangle");
      expect(studio.getState().toolMode).toBe("rectangle");
    });

    it("can select object", () => {
      studio.selectObject("obj-123");
      expect(studio.getState().selectedObjectId).toBe("obj-123");
    });

    it("returns config", () => {
      const cfg = studio.getConfig();
      expect(cfg.previewPort).toBe(3456);
      expect(cfg.studioPort).toBe(3457);
      expect(cfg.mcpPort).toBe(3458);
    });
  });
});