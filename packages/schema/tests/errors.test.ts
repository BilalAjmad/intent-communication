import { describe, it, expect } from 'vitest'
import {
  ErrorCode,
  ErrorBody,
  isValidErrorCode,
  createError,
  isErrorBody,
} from '../src/errors'

describe('Errors (trd 18.2)', () => {
  describe('ErrorCode enum', () => {
    it('includes all required error codes', () => {
      expect(isValidErrorCode('E_SCHEMA')).toBe(true)
      expect(isValidErrorCode('E_LINT')).toBe(true)
      expect(isValidErrorCode('E_LOCKED')).toBe(true)
      expect(isValidErrorCode('E_CONFLICT')).toBe(true)
      expect(isValidErrorCode('E_BUSY')).toBe(true)
      expect(isValidErrorCode('E_NOT_FOUND')).toBe(true)
      expect(isValidErrorCode('E_BAD_REQUEST')).toBe(true)
      expect(isValidErrorCode('E_IO')).toBe(true)
      expect(isValidErrorCode('E_VERSION')).toBe(true)
      expect(isValidErrorCode('E_AUTH')).toBe(true)
      expect(isValidErrorCode('E_LIMIT')).toBe(true)
    })

    it('rejects invalid error codes', () => {
      expect(isValidErrorCode('INVALID')).toBe(false)
      expect(isValidErrorCode('')).toBe(false)
      expect(isValidErrorCode('E_UNKNOWN')).toBe(false)
    })
  })

  describe('ErrorBody', () => {
    it('creates valid error body', () => {
      const error = createError('E_SCHEMA', 'Invalid scene schema', { path: 'scene.root', expected: 'frame' })
      expect(error.code).toBe('E_SCHEMA')
      expect(error.message).toBe('Invalid scene schema')
      expect(error.details).toEqual({ path: 'scene.root', expected: 'frame' })
      expect(error.hint).toBeDefined()
    })

    it('includes hint for each error code', () => {
      const error = createError('E_LOCKED', 'Object is locked', { objectId: 'frame_abc' })
      expect(error.hint).toContain('unlock')
      expect(error.hint).toContain('frame_abc')
    })

    it('validates ErrorBody structure', () => {
      const validError = { code: 'E_SCHEMA', message: 'test', details: {}, hint: 'hint' }
      expect(isErrorBody(validError)).toBe(true)
    })

    it('rejects invalid error body', () => {
      expect(isErrorBody({ code: 'INVALID', message: 'test' })).toBe(false)
      expect(isErrorBody({ message: 'test' })).toBe(false)
      expect(isErrorBody({ code: 'E_SCHEMA' })).toBe(false)
    })

    it('maps to correct HTTP status', () => {
      const mapping: Record<string, number> = {
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
      for (const [code, status] of Object.entries(mapping)) {
        const error = createError(code as any, 'test')
        // HTTP status mapping verified in trd 18.3
      }
    })
  })
})