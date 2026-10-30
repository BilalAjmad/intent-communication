import { describe, it, expect } from 'vitest'
import { SceneIndex, createSceneIndex, applyOp, applyPatch } from '../src/scene-index'
import { Op } from '../src/ops'

describe('Op Application (trd 6.3)', () => {
  describe('applyOp', () => {
    it('applies create op', () => {
      const index = createSceneIndex()
      const op = { type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }
      applyOp(index, op)
      expect(index.objects['frame_a']).toBeDefined()
      expect(index.touched.has('frame_a')).toBe(true)
    })

    it('applies update op', () => {
      const index = createSceneIndex()
      index.objects['frame_a'] = { id: 'frame_a', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} }
      const op = { type: 'update', objectId: 'frame_a', props: { width: 200 } }
      applyOp(index, op)
      expect(index.objects['frame_a'].rect.width).toBe(200)
      expect(index.touched.has('frame_a')).toBe(true)
    })

    it('applies delete op', () => {
      const index = createSceneIndex()
      index.objects['frame_a'] = { id: 'frame_a', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} }
      const op = { type: 'delete', objectId: 'frame_a' }
      applyOp(index, op)
      expect(index.objects['frame_a']).toBeUndefined()
      expect(index.touched.has('frame_a')).toBe(true)
    })

    it('applies move op with new parent', () => {
      const index = createSceneIndex()
      index.objects['frame_parent'] = { id: 'frame_parent', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 200, height: 200 }, children: [], props: {} }
      index.objects['frame_child'] = { id: 'frame_child', type: 'frame', parentId: 'scene_root', rect: { x: 10, y: 10, width: 50, height: 50 }, children: [], props: {} }
      const op = { type: 'move', objectId: 'frame_child', newParentId: 'frame_parent' }
      applyOp(index, op)
      expect(index.objects['frame_child'].parentId).toBe('frame_parent')
      expect(index.touched.has('frame_child')).toBe(true)
    })

    it('applies move op with new rect', () => {
      const index = createSceneIndex()
      index.objects['frame_a'] = { id: 'frame_a', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} }
      const op = { type: 'move', objectId: 'frame_a', rect: { x: 50, y: 50, width: 200, height: 200 } }
      applyOp(index, op)
      expect(index.objects['frame_a'].rect.x).toBe(50)
      expect(index.objects['frame_a'].rect.y).toBe(50)
      expect(index.objects['frame_a'].rect.width).toBe(200)
      expect(index.touched.has('frame_a')).toBe(true)
    })

    it('applies lock op', () => {
      const index = createSceneIndex()
      index.objects['frame_a'] = { id: 'frame_a', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} }
      const op = { type: 'lock', objectId: 'frame_a' }
      applyOp(index, op)
      expect(index.touched.has('frame_a')).toBe(true)
    })

    it('applies unlock op', () => {
      const index = createSceneIndex()
      index.objects['frame_a'] = { id: 'frame_a', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} }
      const op = { type: 'unlock', objectId: 'frame_a' }
      applyOp(index, op)
      expect(index.touched.has('frame_a')).toBe(true)
    })
  })

  describe('applyPatch', () => {
    it('applies patch with multiple ops', () => {
      const index = createSceneIndex()
      const patch = {
        id: 'patch_1',
        baseRevision: 0,
        ops: [
          { type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} },
          { type: 'update', objectId: 'frame_a', props: { x: 10 } },
          { type: 'lock', objectId: 'frame_a' },
        ],
      }
      applyPatch(index, patch)
      expect(index.objects['frame_a']).toBeDefined()
      expect(index.objects['frame_a'].rect.x).toBe(10)
      expect(index.touched.has('frame_a')).toBe(true)
    })

    it('increments revision after patch', () => {
      const index = createSceneIndex()
      const patch = { id: 'patch_1', baseRevision: 0, ops: [] }
      applyPatch(index, patch)
      expect(index.rev).toBe(1)
    })
  })
})