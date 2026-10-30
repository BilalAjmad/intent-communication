import { describe, it, expect } from 'vitest'
import { SceneIndex, createSceneIndex } from '../src/scene-index'

describe('Scene Index', () => {
  describe('createSceneIndex', () => {
    it('creates empty scene index', () => {
      const index = createSceneIndex()
      expect(index.objects).toEqual({})
      expect(index.touched).toEqual(new Set())
      expect(index.rev).toBe(0)
    })

    it('adds objects to index', () => {
      const index = createSceneIndex()
      const obj = { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} }
      index.objects[obj.id] = obj
      expect(index.objects[obj.id]).toBe(obj)
    })

    it('tracks touched objects', () => {
      const index = createSceneIndex()
      index.touched.add('frame_1')
      index.touched.add('frame_2')
      expect(index.touched.size).toBe(2)
      expect(index.touched.has('frame_1')).toBe(true)
    })

    it('increments revision', () => {
      const index = createSceneIndex()
      expect(index.rev).toBe(0)
      index.rev++
      expect(index.rev).toBe(1)
    })
  })
})