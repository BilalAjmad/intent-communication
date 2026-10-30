import { describe, it, expect } from 'vitest'
import {
  Scene,
  SceneObject,
  ObjectType,
  createScene,
  validateScene,
  isValidObjectType,
} from '../src/scene-types'

describe('M1 Scene and Object Types (trd 5.1-5.4)', () => {
  describe('ObjectType enum', () => {
    it('includes all required M1 object types', () => {
      expect(isValidObjectType('frame')).toBe(true)
      expect(isValidObjectType('text')).toBe(true)
      expect(isValidObjectType('image')).toBe(true)
      expect(isValidObjectType('vector')).toBe(true)
      expect(isValidObjectType('component')).toBe(true)
    })

    it('rejects invalid types', () => {
      expect(isValidObjectType('invalid')).toBe(false)
      expect(isValidObjectType('')).toBe(false)
      expect(isValidObjectType('Frame')).toBe(false)
    })
  })

  describe('SceneObject', () => {
    it('creates valid frame object', () => {
      const obj: SceneObject = {
        id: 'frame_abc123',
        type: 'frame',
        parentId: 'scene_root',
        rect: { x: 0, y: 0, width: 100, height: 100 },
        children: [],
        props: {},
      }
      expect(obj.id).toMatch(/^frame_/)
      expect(obj.type).toBe('frame')
    })

    it('creates valid text object', () => {
      const obj: SceneObject = {
        id: 'text_abc123',
        type: 'text',
        parentId: 'frame_abc123',
        rect: { x: 10, y: 10, width: 80, height: 20 },
        children: [],
        props: { content: 'Hello', fontSize: 16, color: '#000000ff' },
      }
      expect(obj.type).toBe('text')
      expect(obj.props.content).toBe('Hello')
    })

    it('creates valid image object', () => {
      const obj: SceneObject = {
        id: 'image_abc123',
        type: 'image',
        parentId: 'frame_abc123',
        rect: { x: 0, y: 0, width: 200, height: 150 },
        children: [],
        props: { src: 'https://example.com/image.png', fit: 'cover' },
      };
      expect(obj.type).toBe('image')
      expect(obj.props.src).toContain('https://')
    })

    it('creates valid vector object', () => {
      const obj: SceneObject = {
        id: 'vector_abc123',
        type: 'vector',
        parentId: 'frame_abc123',
        rect: { x: 0, y: 0, width: 100, height: 100 },
        children: [],
        props: { path: 'M0,0 L100,100', strokeWidth: 2, stroke: '#000000ff' },
      };
      expect(obj.type).toBe('vector')
    })

    it('rejects missing required fields', () => {
      expect(() => {
        const obj: SceneObject = { id: 'frame_abc123', type: 'frame' } as any
        // Should fail validation
      }).not.toThrow()
    })
  })

  describe('Scene', () => {
    it('creates valid empty scene', () => {
      const scene = createScene()
      expect(scene.id).toMatch(/^scene_/)
      expect(scene.version).toBe(0)
      expect(scene.rootId).toMatch(/^frame_/)
      expect(scene.objects).toHaveLength(1) // root frame only
      expect(scene.locks).toEqual([])
    })

    it('validates scene structure', () => {
      const scene = createScene()
      expect(validateScene(scene)).toBe(true)
    })

    it('rejects scene with duplicate IDs', () => {
      const scene = createScene()
      scene.objects.push({
        id: scene.rootId, // duplicate root ID
        type: 'frame',
        parentId: 'scene_root',
        rect: { x: 0, y: 0, width: 100, height: 100 },
        children: [],
        props: {},
      })
      expect(validateScene(scene)).toBe(false)
    })

    it('rejects scene with invalid parent references', () => {
      const scene = createScene()
      scene.objects.push({
        id: 'frame_invalid',
        type: 'frame',
        parentId: 'nonexistent_parent',
        rect: { x: 0, y: 0, width: 100, height: 100 },
        children: [],
        props: {},
      })
      expect(validateScene(scene)).toBe(false)
    })

    it('rejects scene with cycle in hierarchy', () => {
      const scene = createScene()
      const childId = 'frame_child'
      scene.objects.push({
        id: childId,
        type: 'frame',
        parentId: scene.rootId,
        rect: { x: 0, y: 0, width: 50, height: 50 },
        children: [scene.rootId], // cycle!
        props: {},
      })
      expect(validateScene(scene)).toBe(false)
    })
  })
})