import { describe, it, expect } from "vitest";
import { registerMigration, applyMigrations, checkDocumentVersion, documentVersion } from "./migrations";
import { IntentError, ErrorCodes } from "./error.js";

// trd 14.3 / test.md TC-MIG-02..04 — schema version handling.
// MIG-04: this fake v1→v2 migration proves the mechanism works before any
// real migration exists.
describe("document migrations (trd 14.3, TC-MIG-02..04)", () => {
  it("checkDocumentVersion throws E_VERSION for a newer document version", () => {
    expect(() => checkDocumentVersion({ version: 2 }, "scene", 1)).toThrow(IntentError);
    try {
      checkDocumentVersion({ version: 2 }, "scene", 1);
    } catch (err) {
      expect((err as IntentError).code).toBe(ErrorCodes.E_VERSION);
    }
    expect(() => checkDocumentVersion({ schemaVersion: 3 }, "annotations", 1)).toThrow(IntentError);
  });

  it("checkDocumentVersion accepts current and older versions", () => {
    expect(() => checkDocumentVersion({ version: 1 }, "scene", 1)).not.toThrow();
    expect(() => checkDocumentVersion({ version: 0 }, "scene", 1)).not.toThrow();
    expect(() => checkDocumentVersion({}, "scene", 1)).not.toThrow();
  });

  it("documentVersion reads both keys", () => {
    expect(documentVersion({ version: 2 })).toBe(2);
    expect(documentVersion({ schemaVersion: 1 })).toBe(1);
    expect(documentVersion({})).toBeNull();
  });

  it("a registered v1→v2 migration upgrades an old document in memory (MIG-04)", () => {
    registerMigration("testdoc", 1, (doc) => ({ ...doc, version: 2, upgraded: true }));
    const out = applyMigrations("testdoc", { version: 1, keep: "me" }, 2);
    expect(out["version"]).toBe(2);
    expect(out["upgraded"]).toBe(true);
    expect(out["keep"]).toBe("me");
  });

  it("applyMigrations leaves documents untouched when no step is registered", () => {
    const out = applyMigrations("never-registered-doc", { version: 1, keep: "me" }, 2);
    expect(out).toEqual({ version: 1, keep: "me" });
  });

  it("applyMigrations rejects a migration that does not advance the version (loud failure)", () => {
    registerMigration("bad-migration-doc", 1, (doc) => ({ ...doc }));
    expect(() => applyMigrations("bad-migration-doc", { version: 1 }, 2)).toThrow(IntentError);
    try {
      applyMigrations("bad-migration-doc", { version: 1 }, 2);
    } catch (err) {
      expect((err as IntentError).code).toBe(ErrorCodes.E_VERSION);
    }
  });
});
