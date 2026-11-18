import { IntentError, ErrorCodes } from "./error.js";

/**
 * trd 14.3 / test.md TC-MIG-02..04 — document version handling.
 *
 * - A file whose version (`version` or `schemaVersion`) is newer than this
 *   build knows how to read throws E_VERSION and is never modified.
 * - Older documents are upgraded in memory by registered migrations; the
 *   migrated form is written only on the next accepted write. Reading never writes.
 * - Zod defaults already carry v1 documents forward, so no real migrations
 *   exist yet. `registerMigration` + `applyMigrations` are the mechanism; the
 *   test suite registers a fake v1→v2 migration to prove it works (MIG-04).
 * - A migration must advance the document version or it is rejected loudly.
 */

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>;

const REGISTRY = new Map<string, Map<number, Migration>>();

export function registerMigration(kind: string, fromVersion: number, migrate: Migration): void {
  const byVersion = REGISTRY.get(kind) ?? new Map<number, Migration>();
  byVersion.set(fromVersion, migrate);
  REGISTRY.set(kind, byVersion);
}

export function documentVersion(doc: unknown): number | null {
  if (!doc || typeof doc !== "object") return null;
  const rec = doc as Record<string, unknown>;
  const v = rec["version"] ?? rec["schemaVersion"];
  return typeof v === "number" && Number.isInteger(v) ? v : null;
}

export function checkDocumentVersion(doc: unknown, kind: string, currentVersion: number): void {
  const v = documentVersion(doc);
  if (v !== null && v > currentVersion) {
    throw new IntentError(
      ErrorCodes.E_VERSION,
      `${kind} was written by a newer version of intent-studio (document v${v}; this build reads up to v${currentVersion}). Upgrade intent-studio instead of modifying the file.`,
    );
  }
}

export function applyMigrations(kind: string, doc: Record<string, unknown>, currentVersion: number): Record<string, unknown> {
  let out = doc;
  let v = documentVersion(out) ?? 1;
  while (v < currentVersion) {
    const step = REGISTRY.get(kind)?.get(v);
    if (!step) return out; // no migration registered for this step — zod defaults carry it
    out = step(out);
    const next = documentVersion(out);
    if (next === null || next <= v) {
      throw new IntentError(ErrorCodes.E_VERSION, `Migration for ${kind} v${v} did not advance the document version`);
    }
    v = next;
  }
  return out;
}
