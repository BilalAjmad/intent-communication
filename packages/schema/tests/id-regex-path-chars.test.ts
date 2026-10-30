import { describe, it, expect } from 'vitest'
import { ID_REGEX, validateId } from '../src/ids'

describe('ID Regex Rejects Path Characters (trd 3)', () => {
  describe('ID_REGEX', () => {
    it('matches valid IDs', () => {
      expect('scene_abc123').toMatch(ID_REGEX)
      expect('patch_xyz789').toMatch(ID_REGEX)
      expect('version_001').toMatch(ID_REGEX)
      expect('lock_abc').toMatch(ID_REGEX)
      expect('frame_a1b2c3').toMatch(ID_REGEX)
    })

    it('rejects forward slash', () => {
      expect('scene_a/b').not.toMatch(ID_REGEX)
      expect('scene/a').not.toMatch(ID_REGEX)
      expect('a/b/c').not.toMatch(ID_REGEX)
      expect('path/to/scene').not.toMatch(ID_REGEX)
    })

    it('rejects backslash', () => {
      expect('scene_a\\b').not.toMatch(ID_REGEX)
      expect('path\\to\\scene').not.toMatch(ID_REGEX)
    })

    it('rejects dots in middle', () => {
      expect('scene_a.b').not.toMatch(ID_REGEX)
      expect('scene..double').not.toMatch(ID_REGEX)
      expect('scene.').not.toMatch(ID_REGEX)
      expect('.scene').not.toMatch(ID_REGEX)
    })

    it('rejects spaces', () => {
      expect('scene a').not.toMatch(ID_REGEX)
      expect('scene a b').not.toMatch(ID_REGEX)
    })

    it('rejects special characters', () => {
      expect('scene@domain').not.toMatch(ID_REGEX)
      expect('scene#hash').not.toMatch(ID_REGEX)
      expect('scene$dollar').not.toMatch(ID_REGEX)
      expect('scene%percent').not.toMatch(ID_REGEX)
      expect('scene^caret').not.toMatch(ID_REGEX)
      expect('scene&ampersand').not.toMatch(ID_REGEX)
      expect('scene*star').not.toMatch(ID_REGEX)
      expect('scene(paren)').not.toMatch(ID_REGEX)
      expect('scene[bracket]').not.toMatch(ID_REGEX)
      expect('scene{brace}').not.toMatch(ID_REGEX)
      expect('scene|pipe').not.toMatch(ID_REGEX)
      expect('scene<lt>').not.toMatch(ID_REGEX)
      expect('scene>gt').not.toMatch(ID_REGEX)
      expect('scene?question').not.toMatch(ID_REGEX)
      expect('scene=equals').not.toMatch(ID_REGEX)
      expect('scene+plus').not.toMatch(ID_REGEX)
      expect('scene!bang').not.toMatch(ID_REGEX)
      expect('scene~tilde').not.toMatch(ID_REGEX)
      expect('scene`backtick').not.toMatch(ID_REGEX)
      expect('scene;semicolon').not.toMatch(ID_REGEX)
      expect('scene:colon').not.toMatch(ID_REGEX)
      expect('scene"quote').not.toMatch(ID_REGEX)
      expect("scene'apostrophe").not.toMatch(ID_REGEX)
      expect('scene,comma').not.toMatch(ID_REGEX)
    })

    it('allows underscore and alphanumeric', () => {
      expect('scene_a').toMatch(ID_REGEX)
      expect('scene_123').toMatch(ID_REGEX)
      expect('scene_a1b2c3').toMatch(ID_REGEX)
      expect('scene_a_b_c').toMatch(ID_REGEX)
    })

    it('requires prefix and underscore', () => {
      expect('scene').not.toMatch(ID_REGEX)
      expect('scene_').not.toMatch(ID_REGEX)
      expect('_scene').not.toMatch(ID_REGEX)
      expect('123').not.toMatch(ID_REGEX)
    })

    it('allows single character after underscore', () => {
      expect('scene_a').toMatch(ID_REGEX)
      expect('patch_x').toMatch(ID_REGEX)
      expect('version_1').toMatch(ID_REGEX)
    })
  })

  describe('validateId', () => {
    it('accepts valid IDs', () => {
      expect(validateId('scene_abc123')).toBe(true)
      expect(validateId('patch_xyz789')).toBe(true)
      expect(validateId('version_001')).toBe(true)
      expect(validateId('lock_abc')).toBe(true)
      expect(validateId('frame_a1b2c3')).toBe(true)
    })

    it('rejects IDs with path characters', () => {
      expect(validateId('scene_a/b')).toBe(false)
      expect(validateId('scene_a\\b')).toBe(false)
    })

    it('rejects IDs with dots', () => {
      expect(validateId('scene_a.b')).toBe(false)
      expect(validateId('scene.a')).toBe(false)
      expect(validateId('.scene')).toBe(false)
    })

    it('rejects IDs with spaces', () => {
      expect(validateId('scene a')).toBe(false)
    })

    it('rejects IDs with special characters', () => {
      expect(validateId('scene@domain')).toBe(false)
      expect(validateId('scene#hash')).toBe(false)
      expect(validateId('scene!bang')).toBe(false)
    })
  })
})