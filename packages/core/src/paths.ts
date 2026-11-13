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
const ILLEGAL_ID_CHARS = ["..", "/", "\\", "\0"];

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
}
