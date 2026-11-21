import { IntentError, ErrorCodes } from "./error.js";

/**
 * Maximum length of an identifier that is used as a filesystem path segment.
 *
 * Identifiers become file names under `.intent/`. Windows caps a path at
 * 260 characters by default, so an unbounded identifier turns a client error
 * into an opaque ENOENT/ENAMETOOLONG from the filesystem. Rejecting it up
 * front turns that into a clean E_BAD_REQUEST.
 */
export const MAX_ID_LENGTH = 120;

/** Characters that must never appear in an identifier used as a path segment. */
const ILLEGAL_ID_CHARS = ["..", "/", "\\", "\0", ":"];

/** Windows reserved device names — invalid as any file name on Windows (case-insensitive, stem match). */
const RESERVED_DEVICE_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

/** Prototype-pollution keys — never valid identifiers, whatever the alphabet allows. */
const FORBIDDEN_PROTO_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Validates an identifier that will be used as a filesystem path segment.
 *
 * Throws an IntentError with E_BAD_REQUEST for an empty id, an over-long id,
 * or an id containing a path separator, a `..` segment, or a NUL byte.
 */
export function assertSafeId(id: string, label: string): void {
  if (typeof id !== "string" || id.length === 0) {
    throw new IntentError(ErrorCodes.E_BAD_REQUEST, `${label} must be a non-empty string`);
  }
  if (id.length > MAX_ID_LENGTH) {
    throw new IntentError(
      ErrorCodes.E_BAD_REQUEST,
      `${label} must be at most ${MAX_ID_LENGTH} characters (got ${id.length})`
    );
  }
  for (const bad of ILLEGAL_ID_CHARS) {
    if (id.includes(bad)) {
      throw new IntentError(
        ErrorCodes.E_BAD_REQUEST,
        `${label} must not contain "${bad === "\0" ? "\\0" : bad}"`
      );
    }
  }
  // Windows file-name rules: no trailing dot/space, and no reserved device stems.
  if (id.endsWith(".") || id.endsWith(" ")) {
    throw new IntentError(ErrorCodes.E_BAD_REQUEST, `${label} must not end with a dot or space`);
  }
  const stem = id.split(".")[0]?.toUpperCase() ?? "";
  if (RESERVED_DEVICE_NAMES.has(stem)) {
    throw new IntentError(ErrorCodes.E_BAD_REQUEST, `${label} must not be the reserved device name "${stem}"`);
  }
  if (FORBIDDEN_PROTO_KEYS.has(id)) {
    throw new IntentError(ErrorCodes.E_BAD_REQUEST, `${label} must not be "${id}"`);
  }
}
