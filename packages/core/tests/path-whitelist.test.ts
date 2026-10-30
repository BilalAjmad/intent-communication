import { describe, it, expect } from 'vitest'
import { checkPathWhitelist } from '../src/security'

describe('Path Whitelist (trd 6.3)', () => {
  describe('checkPathWhitelist', () => {
    it('allows paths within .intent/', () => {
      expect(checkPathWhitelist('.intent/scene.json')).toBe(true)
      expect(checkPathWhitelist('.intent/patches/patch_1.json')).toBe(true)
      expect(checkPathWhitelist('.intent/locks.json')).toBe(true)
      expect(checkPathWhitelist('.intent/versions/1.json')).toBe(true)
    })

    it('rejects paths outside .intent/', () => {
      expect(checkPathWhitelist('/etc/passwd')).toBe(false)
      expect(checkPathWhitelist('../secret.txt')).toBe(false)
      expect(checkPathWhitelist('C:\\Windows\\System32')).toBe(false)
      expect(checkPathWhitelist('/home/user/.ssh/id_rsa')).toBe(false)
    })

    it('rejects absolute paths', () => {
      expect(checkPathWhitelist('/absolute/path')).toBe(false)
      expect(checkPathWhitelist('C:\\absolute')).toBe(false)
    })
  })
})