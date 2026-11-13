import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, createServerFromConfig } from "./index";
import { tmpdir } from "node:os";
import { Config as SchemaConfig } from "@intent/schema";

// The security suite lives in security.test.ts.

describe("Server package", () => {
  const testDir = tmpdir() + "/.test-server";
  let server: ReturnType<typeof createServer>;
  const config: SchemaConfig = {
    version: 1,
    projectName: "Test",
    previewPort: 3456,
    studioPort: 3457,
    mcpPort: 3458,
    maxBytes: 32768,
    autoSave: true,
    lockTTL: 30000,
  };

  beforeEach(() => {
    server = createServer({
      projectRoot: testDir,
      previewPort: 0,
      studioPort: 3457,
      mcpPort: 3458,
    });
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  describe("createServer", () => {
    it("creates server instance", () => {
      expect(server).toBeDefined();
    });
  });

  describe("createServerFromConfig", () => {
    it("creates server from config", () => {
      const s = createServerFromConfig(testDir, config);
      expect(s).toBeDefined();
    });
  });
});
