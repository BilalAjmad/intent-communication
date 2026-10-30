import { describe, it, expect } from 'vitest'
import {
  State,
  Locks,
  Versions,
  createState,
  validateState,
  createLocks,
  validateLocks,
  createVersions,
  validateVersions,
} from '../src/state-locks-versions'

describe('State, Locks, Versions', () => {
  describe('State', () => {
    it('creates valid initial state', () => {
      const state = createState()
      expect(state.scene.id).toMatch(/^scene_/)
      expect(state.scene.version).toBe(0)
      expect(state.revision).toBe(0)
      expect(state.interview).toEqual({
        status: 'none',
        meter: 0,
        currentQuestion: null,
        delegated: [],
        answers: {},
        reopen: [],
      })
    })

    it('validates state structure', () => {
      const state = createState()
      expect(validateState(state)).toBe(true)
    })

    it('rejects state with negative revision', () => {
      const state = { ...createState(), revision: -1 }
      expect(validateState(state)).toBe(false)
    })
  })

  describe('Locks', () => {
    it('creates empty locks', () => {
      const locks = createLocks()
      expect(locks.objects).toEqual({})
      expect(locks.order).toEqual([])
    })

    it('validates lock structure', () => {
      const locks = { objects: { 'frame_abc': { objectId: 'frame_abc', lockedBy: 'user', timestamp: Date.now() } }, order: ['frame_abc'] }
      expect(validateLocks(locks)).toBe(true)
    })

    it('rejects locks with invalid structure', () => {
      expect(validateLocks({ objects: {}, order: [] })).toBe(true)
      expect(validateLocks({ objects: { a: { objectId: 'a' } }, order: [] })).toBe(false) // missing in order
    })
  })

  describe('Versions', () => {
    it('creates empty versions', () => {
      const versions = createVersions()
      expect(versions.current).toBe(0)
      expect(versions.history).toEqual([])
    })

    it('validates versions structure', () => {
      const versions = {
        current: 3,
        history: [
          { version: 1, timestamp: Date.now(), sceneHash: 'abc1', patchId: 'patch_1' },
          { version: 2, timestamp: Date.now(), sceneHash: 'abc2', patchId: 'patch_2' },
          { version: 3, timestamp: Date.now(), sceneHash: 'abc3', patchId: 'patch_3' },
        ],
      }
      expect(validateVersions(versions)).toBe(true)
    })

    it('rejects versions with gaps', () => {
      const versions = { current: 3, history: [{ version: 1, timestamp: Date.now(), sceneHash: 'abc', patchId: 'patch_1' }, { version: 3, timestamp: Date.now(), sceneHash: 'abc', patchId: 'patch_3' }] }
      expect(validateVersions(versions)).toBe(false)
    })
  })
})