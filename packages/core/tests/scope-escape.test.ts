import { describe, it, expect } from 'vitest'
import { checkScopeEscape, checkMoveOutOfSubtree } from '../src/security'

describe('Scope Escape Check (trd 6.3)', () => {
  describe('checkScopeEscape', () => {
    it('detects move out of subtree', () => {
      const scene = {
        objects: {
          'frame_root': { id: 'frame_root', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 1920, height: 1080 }, children: ['frame_child'], props: {} },
          'frame_child': { id: 'frame_child', type: 'frame', parentId: 'frame_root', rect: { x: 10, y: 10, width: 100, height: 100 }, children: [], props: {} },
          'frame_outside': { id: 'frame_outside', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} },
        },
        rootId: 'frame_root',
      }
      expect(checkScopeEscape(scene, 'frame_child', 'frame_outside')).toBe(true)
    })

    it('allows move within subtree', () => {
      const scene = {
        objects: {
          'frame_root': { id: 'frame_root', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 1920, height: 1080 }, children: ['frame_parent'], props: {} },
          'frame_parent': { id: 'frame_parent', type: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 500, height: 500 }, children: ['frame_child'], props: {} },
          'frame_child': { id: 'frame_child', type: 'frame', parentId: 'frame_parent', rect: { x: 10, y: 10, width: 100, height: 100 }, children: [], props: {} },
        },
        rootId: 'frame_root',
      }
      expect(checkScopeEscape(scene, 'frame_child', 'frame_parent')).toBe(false)
    })
  })

  describe('Move Out of Subtree Check', () => {
    it('detects move that breaks hierarchy', () => {
      const scene = {
        objects: {
          'frame_root': { id: 'frame_root', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 1920, height: 1080 }, children: ['frame_a'], props: {} },
          'frame_a': { id: 'frame_a', type: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 500, height: 500 }, children: ['frame_b'], props: {} },
          'frame_b': { id: 'frame_b', type: 'frame', parentId: 'frame_a', rect: { x: 10, y: 10, width: 100, height: 100 }, children: [], props: {} },
          'frame_c': { id: 'frame_c', type: 'frame', parentId: 'scene_root', rect: { x: 1000, y: 1000, width: 100, height: 100 }, children: [], props: {} },
        },
        rootId: 'frame_root',
      }
      expect(checkMoveOutOfSubtree(scene, 'frame_b', 'frame_root')).toBe(true)
    })

    it('allows move within same parent', () => {
      const scene = {
        objects: {
          'frame_root': { id: 'frame_root', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 1920, height: 1080 }, children: ['frame_a', 'frame_b'], props: {} },
          'frame_a': { id: 'frame_a', type: 'frame', parentId: 'frame_root', rect: { x: 10, y: 10, width: 100, height: 100 }, children: [], props: {} },
          'frame_b': { id: 'frame_b', type: 'frame', parentId: 'frame_root', rect: { x: 200, y: 10, width: 100, height: 100 }, children: [], props: {} },
        },
        rootId: 'frame_root',
      }
      expect(checkMoveOutOfSubtree(scene, 'frame_a', 'frame_root')).toBe(false)
    })
  })
})