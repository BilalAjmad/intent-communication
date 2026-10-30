import { describe, it, expect } from 'vitest'
import { SchemaId, SceneId, PatchId, generateId, validateId, ID_REGEX } from '../src/ids'

describe('Schema IDs (trd 3)', () => {
  describe('generateId', () => {
    it('generates valid IDs matching regex', () => {
      const id = generateId('scene')
      expect(id).toMatch(ID_REGEX)
      expect(id).toContain('scene_')
    })

    it('generates unique IDs', () => {
      const ids = new Set()
      for (let i = 0; i < 1000; i++) {
        ids.add(generateId('scene'))
      }
      expect(ids.size).toBe(1000)
    })

    it('generates different prefixes for different types', () => {
      expect(generateId('scene')).toContain('scene_')
      expect(generateId('patch')).toContain('patch_')
      expect(generateId('version')).toContain('version_')
      expect(generateId('lock')).toContain('lock_')
    })
  })

  describe('validateId', () => {
    it('accepts valid IDs', () => {
      expect(validateId('scene_abc123')).toBe(true)
      expect(validateId('patch_xyz789')).toBe(true)
      expect(validateId('version_001')).toBe(true)
    })

    it('rejects invalid IDs', () => {
      expect(validateId('')).toBe(false)
      expect(validateId('invalid')).toBe(false)
      expect(validateId('scene')).toBe(false)
      expect(validateId('scene-')).toBe(false)
      expect(validateId('scene_123_')).toBe(false)
      expect(validateId('SCENE_123')).toBe(false)
    })

    it('rejects path-like characters', () => {
      expect(validateId('scene_a/b')).toBe(false)
      expect(validateId('scene_a.b')).toBe(false)
      expect(validateId('scene_a-b')).toBe(false)
    })
  })

  describe('ID_REGEX', () => {
    it('matches valid format: prefix_alphanumeric', () => {
      expect('scene_abc123').toMatch(ID_REGEX)
      expect('patch_xyz789').toMatch(ID_REGEX)
      expect('version_001').toMatch(ID_REGEX)
      expect('lock_abc').toMatch(ID_REGEX)
    })

    it('rejects invalid formats', () => {
      expect('scene').not.toMatch(ID_REGEX)
      expect('scene_').not.toMatch(ID_REGEX)
      expect('scene-a').not.toMatch(ID_REGEX)
      expect('scene.a').not.toMatch(ID_REGEX)
      expect('scene_a b').not.toMatch(ID_REGEX)
    })
  })
})