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
  E_NOT_FOUND: "E_NOT_FOUND",
  E_CONFLICT: "E_CONFLICT",
  E_LOCKED: "E_LOCKED",
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
