/**
 * Errors (trd 18.2)
 * Standardized error codes and response format.
 */

export type ErrorCode =
  | 'E_SCHEMA'
  | 'E_LINT'
  | 'E_LOCKED'
  | 'E_CONFLICT'
  | 'E_BUSY'
  | 'E_NOT_FOUND'
  | 'E_BAD_REQUEST'
  | 'E_IO'
  | 'E_VERSION'
  | 'E_AUTH'
  | 'E_LIMIT'

export const ERROR_CODES: ErrorCode[] = [
  'E_SCHEMA', 'E_LINT', 'E_LOCKED', 'E_CONFLICT', 'E_BUSY',
  'E_NOT_FOUND', 'E_BAD_REQUEST', 'E_IO', 'E_VERSION',
  'E_AUTH', 'E_LIMIT',
]

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  E_SCHEMA: 'Schema validation failed',
  E_LINT: 'Design rule violation',
  E_LOCKED: 'Object is locked',
  E_CONFLICT: 'Conflict detected',
  E_BUSY: 'Service temporarily unavailable',
  E_NOT_FOUND: 'Resource not found',
  E_BAD_REQUEST: 'Invalid request',
  E_IO: 'I/O error',
  E_VERSION: 'Version conflict',
  E_AUTH: 'Authentication required',
  E_LIMIT: 'Limit exceeded',
}

export const ERROR_HINTS: Record<ErrorCode, string> = {
  E_SCHEMA: 'Check the schema validation errors and fix the input',
  E_LINT: 'Apply the suggested fix or adjust the design',
  E_LOCKED: 'Unlock the object or wait for the lock to be released',
  E_CONFLICT: 'Retry the operation after pulling latest changes',
  E_BUSY: 'Retry after a short delay',
  E_NOT_FOUND: 'Check the resource ID and try again',
  E_BAD_REQUEST: 'Verify the request format and parameters',
  E_IO: 'Check disk space and permissions',
  E_VERSION: 'Pull the latest version and retry',
  E_AUTH: 'Provide valid authentication credentials',
  E_LIMIT: 'Reduce the request size or wait for limit to reset',
}

export interface ErrorBody {
  code: ErrorCode
  message: string
  details?: Record<string, unknown>
  hint?: string
}

export function isValidErrorCode(code: string): code is ErrorCode {
  return ERROR_CODES.includes(code as ErrorCode)
}

export function createError(
  code: ErrorCode,
  message?: string,
  details?: Record<string, unknown>,
  hint?: string
): ErrorBody {
  let hintText = hint || ERROR_HINTS[code]
  if (details && details.objectId) {
    hintText += ` (objectId: ${details.objectId})`
  }
  return {
    code,
    message: message || ERROR_MESSAGES[code],
    details,
    hint: hintText,
  }
}

export function isErrorBody(body: unknown): body is ErrorBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return typeof b.code === 'string' &&
    isValidErrorCode(b.code as ErrorCode) &&
    typeof b.message === 'string' &&
    (b.details === undefined || typeof b.details === 'object') &&
    (b.hint === undefined || typeof b.hint === 'string')
}

export const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  E_SCHEMA: 400,
  E_BAD_REQUEST: 400,
  E_AUTH: 403,
  E_NOT_FOUND: 404,
  E_CONFLICT: 409,
  E_LOCKED: 423,
  E_LIMIT: 413,
  E_BUSY: 503,
  E_LINT: 422,
  E_IO: 500,
  E_VERSION: 409,
}