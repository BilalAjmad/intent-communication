import { describe, it, expect } from 'vitest'
import { checkRemoveWithLockedDescendant, checkLockInheritance } from '../src/security'

describe('Remove with Locked Descendant Check', () => {
  it('rejects delete of object with locked descendant', () => {
    const scene = {
      objects: {
        'frame_parent': { id: 'frame_parent', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 500, height: 500 }, children: ['frame_child'], props: {} },
        'frame_child': { id: 'frame_child', type: 'frame', parentId: 'frame_parent', rect: { x: 10, y: 10, width: 100, height: 100 }, children: [], props: {} },
      },
      locks: [{ objectId: 'frame_child', lockedBy: 'user', timestamp: Date.now() }],
      rootId: 'frame_root',
    }
    expect(checkRemoveWithLockedDescendant(scene, 'frame_parent')).toBe(true)
  })

  it('allows delete of object without locked descendants', () => {
    const scene = {
      objects: {
        'frame_parent': { id: 'frame_parent', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 500, height: 500 }, children: ['frame_child'], props: {} },
        'frame_child': { id: 'frame_child', type: 'frame', parentId: 'frame_parent', rect: { x: 10, y: 10, width: 100, height: 100 }, children: [], props: {} },
      },
      locks: [],
      rootId: 'frame_root',
    }
    expect(checkRemoveWithLockedDescendant(scene, 'frame_parent')).toBe(false)
  })
})

describe('Lock Inheritance Check (trd 9.2)', () => {
  it('detects locked parent blocks child', () => {
    const locks = [
      { objectId: 'frame_parent', lockedBy: 'user', timestamp: Date.now() },
    ]
    expect(checkLockInheritance({ objects: { 'frame_child': { parentId: 'frame_parent' } }, locks }, 'frame_child')).toBe(true)
  })

  it('detects locked ancestor blocks descendant', () => {
    const locks = [
      { objectId: 'frame_root', lockedBy: 'user', timestamp: Date.now() },
    ]
    const scene = {
      objects: {
        'frame_root': { id: 'frame_root', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 1920, height: 1080 }, children: ['frame_a'], props: {} },
        'frame_a': { id: 'frame_a', type: 'frame', parentId: 'frame_root', rect: { x: 10, y: 10, width: 100, height: 100 }, children: ['frame_b'], props: {} },
        'frame_b': { id: 'frame_b', type: 'frame', parentId: 'frame_a', rect: { x: 10, y: 10, width: 50, height: 50 }, children: [], props: {} },
      },
      locks,
      rootId: 'frame_root',
    }
    expect(checkLockInheritance(scene, 'frame_b')).toBe(true)
  })

  it('allows operation when no ancestor locked', () => {
    const locks: any[] = []
    expect(checkLockInheritance({ objects: { 'frame_a': { parentId: 'scene_root' } }, locks }, 'frame_a')).toBe(false)
  })
})