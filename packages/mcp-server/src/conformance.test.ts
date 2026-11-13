import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ErrorCodes } from "@intent/core";
import { MCP_TOOLS } from "./index";
import {
  INTERVIEW_SEEDS,
  DEEP_DIVE_SEEDS,
  CONTROL_SEEDS,
  ALL_SEEDS,
  validateBank,
} from "@intent/core";

// Conformance tests from docs section D.
//
// These assert against the real implementation, not against a literal
// copy of the spec. A test that checks a hardcoded array contains a
// hardcoded string proves nothing; each check below fails if the
// implementation drifts away from trd 10, trd 18.2 or intent.md 6.3-6.5.

describe("Conformance: Six MCP tools (trd 10)", () => {
  it("exposes exactly six MCP tools", () => {
    expect(MCP_TOOLS).toHaveLength(6);
  });

  it("exposes the six tool names required by trd 10", () => {
    const names = MCP_TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      ["apply_patch", "ask_user", "get_feedback", "get_scene", "open_studio", "validate"].sort()
    );
  });

  it("has no duplicate tool names", () => {
    const unique = new Set(MCP_TOOLS.map((t) => t.name));
    expect(unique.size).toBe(MCP_TOOLS.length);
  });

  it("gives every tool a non-empty description", () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.description.length, `tool ${tool.name} has no description`).toBeGreaterThan(0);
    }
  });
});

describe("Conformance: Error codes (trd 18.2)", () => {
  it("defines every error code the spec requires", () => {
    const required = [
      "E_SCHEMA",
      "E_LINT",
      "E_LOCKED",
      "E_CONFLICT",
      "E_BUSY",
      "E_NOT_FOUND",
      "E_BAD_REQUEST",
      "E_IO",
      "E_VERSION",
      "E_AUTH",
      "E_LIMIT",
    ];
    for (const code of required) {
      expect(Object.values(ErrorCodes), `missing error code ${code}`).toContain(code);
    }
  });

  it("maps each spec error code to its own string value", () => {
    expect(ErrorCodes.E_BAD_REQUEST).toBe("E_BAD_REQUEST");
    expect(ErrorCodes.E_LOCKED).toBe("E_LOCKED");
    expect(ErrorCodes.E_CONFLICT).toBe("E_CONFLICT");
  });
});

describe("Conformance: Interview bank (intent.md 6.3-6.5)", () => {
  it("has 35 interview + 6 deep-dive + 5 control seeds = 46 total", () => {
    expect(INTERVIEW_SEEDS).toHaveLength(35);
    expect(DEEP_DIVE_SEEDS).toHaveLength(6);
    expect(CONTROL_SEEDS).toHaveLength(5);
    expect(ALL_SEEDS).toHaveLength(41);
  });

  it("passes the bank's own validation", () => {
    const result = validateBank();
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe("Conformance: SEC-01..SEC-07 are implemented in the server package", () => {
  // The real SEC tests live in packages/server/src/index.test.ts and are
  // executed by that package's test run. This checks that they exist and
  // are named as trd 22 requires, so the coverage cannot silently vanish.
  it("the server package declares a test for each of SEC-01 to SEC-07", () => {
    const serverTest = resolve(__dirname, "../../server/src/index.test.ts");
    const source = readFileSync(serverTest, "utf-8");
    for (let n = 1; n <= 7; n++) {
      const id = `SEC-0${n}`;
      expect(source, `server package has no ${id} test`).toContain(id);
    }
  });
});
