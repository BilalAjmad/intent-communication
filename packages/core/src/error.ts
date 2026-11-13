export class IntentError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "IntentError";
  }
}

export const ErrorCodes = {
  // Codes from trd 18.2 — the authoritative list.
  E_SCHEMA: "E_SCHEMA",
  E_LINT: "E_LINT",
  E_LOCKED: "E_LOCKED",
  E_CONFLICT: "E_CONFLICT",
  E_BUSY: "E_BUSY",
  E_NOT_FOUND: "E_NOT_FOUND",
  E_BAD_REQUEST: "E_BAD_REQUEST",
  E_IO: "E_IO",
  E_VERSION: "E_VERSION",
  E_AUTH: "E_AUTH",
  E_LIMIT: "E_LIMIT",

  // Storage-level codes.
  E_INVALID_PATCH: "E_INVALID_PATCH",
  E_INVALID_SCENE: "E_INVALID_SCENE",
  E_STORAGE: "E_STORAGE",
  E_PERMISSION: "E_PERMISSION",
  E_SYMLINK: "E_SYMLINK",
  E_PATH_TRAVERSAL: "E_PATH_TRAVERSAL",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export function isIntentError(err: unknown): err is IntentError {
  return err instanceof IntentError;
}
