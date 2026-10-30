import { describe, it, expect } from 'vitest'
import { lintTouch, LTouchRule } from '../src/l-touch'

describe('L-TOUCH - Touch Target Sizing', () => {
  describe('lintTouch', () => {
    it('passes when touch targets meet 44x44 minimum', () => {
      const scene = {
        id: 'scene_1', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} },
          { id: 'button_1', type: 'component', parentId: 'frame_1', rect: { x: 10, y: 10, width: 44, height: 44 }, children: [], props: { role: 'button' } },
        ],
        locks: [],
      }
      const result = lintTouch(scene)
      expect(result.errors).toHaveLength(0)
    })

    it('fails when button is smaller than 44x44', () => {
      const scene = {
        id: 'scene_1', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} },
          { id: 'button_1', type: 'component', parentId: 'frame_1', rect: { x: 10, y: 10, width: 30, height: 30 }, children: [], props: { role: 'button' } },
        ],
        locks: [],
      }
      const result = lintTouch(scene)
      expect(result.errors.some(e => e.code === 'L-TOUCH-SIZE')).toBe(true)
    })

    it('fails when width < 44 but height >= 44', () => {
      const scene = {
        id: 'scene_1', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} },
          { id: 'button_1', type: 'component', parentId: 'frame_1', rect: { x: 10, y: 10, width: 30, height: 50 }, children: [], props: { role: 'button' } },
        ],
        locks: [],
      }
      const result = lintTouch(scene)
      expect(result.errors.some(e => e.code === 'L-TOUCH-WIDTH')).toBe(true)
    })

    it('fails when height < 44 but width >= 44', () => {
      const scene = {
        id: 'scene_1', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} },
          { id: 'button_1', type: 'component', parentId: 'frame_1', rect: { x: 10, y: 10, width: 50, height: 30 }, children: [], props: { role: 'button' } },
        ],
        locks: [],
      }
      const result = lintTouch(scene)
      expect(result.errors.some(e => e.code === 'L-TOUCH-HEIGHT')).toBe(true)
    })

    it('checks link touch targets', () => {
      const scene = {
        id: 'scene_1', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} },
          { id: 'link_1', type: 'text', parentId: 'frame_1', rect: { x: 10, y: 10, width: 30, height: 20 }, children: [], props: { content: 'Link', role: 'link' } },
        ],
        locks: [],
      }
      const result = lintTouch(scene)
      expect(result.errors.some(e => e.code === 'L-TOUCH-SIZE')).toBe(true)
    })

    it('passes non-interactive elements below 44px', () => {
      const scene = {
        id: 'scene_1', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} },
          { id: 'text_1', type: 'text', parentId: 'frame_1', rect: { x: 10, y: 10, width: 30, height: 20 }, children: [], props: { content: 'Static text' } },
        ],
        locks: [],
      }
      const result = lintTouch(scene)
      expect(result.errors).toHaveLength(0)
    })
  })
})