import { describe, it, expect } from 'vitest'
import { SceneSchema, ObjectTypeSchema, PatchSchema, ConfigSchema } from '../src/schemas'

describe('Closed Grammars Reject Free-form CSS (trd 5.1-5.4)', () => {
  describe('SceneSchema', () => {
    it('accepts valid scene', () => {
      const scene = { id: 'scene_abc', version: 0, rootId: 'frame_root', objects: [], locks: [] }
      const result = SceneSchema.safeParse(scene)
      expect(result.success).toBe(true)
    })

    it('rejects scene with extra properties', () => {
      const scene = { id: 'scene_abc', version: 0, rootId: 'frame_root', objects: [], locks: [], extra: 'not allowed' }
      const result = SceneSchema.safeParse(scene)
      expect(result.success).toBe(false)
    })

    it('rejects scene with invalid object', () => {
      const scene = { id: 'scene_abc', version: 0, rootId: 'frame_root', objects: [{ id: 'bad', type: 'invalid', parentId: 'x', rect: { x: 0, y: 0, width: 10, height: 10 }, children: [], props: {} }], locks: [] }
      const result = SceneSchema.safeParse(scene)
      expect(result.success).toBe(false)
    })
  })

  describe('ObjectTypeSchema (Closed Grammar)', () => {
    it('accepts only valid M1 object types', () => {
      const validTypes = ['frame', 'text', 'image', 'vector', 'component']
      for (const type of validTypes) {
        const result = ObjectTypeSchema.safeParse(type)
        expect(result.success).toBe(true)
      }
    })

    it('rejects free-form CSS-like types', () => {
      const invalidTypes = ['div', 'span', 'button', 'input', 'custom-widget', 'my-frame', 'text-with-style', 'frame.custom']
      for (const type of invalidTypes) {
        const result = ObjectTypeSchema.safeParse(type)
        expect(result.success).toBe(false)
      }
    })

    it('rejects CSS property names as types', () => {
      const cssProperties = ['color', 'background', 'font-size', 'margin', 'padding', 'border', 'display', 'flex', 'grid']
      for (const prop of cssProperties) {
        const result = ObjectTypeSchema.safeParse(prop)
        expect(result.success).toBe(false)
      }
    })

    it('rejects arbitrary strings', () => {
      const result = ObjectTypeSchema.safeParse('any-random-string')
      expect(result.success).toBe(false)
    })

    it('rejects empty string', () => {
      const result = ObjectTypeSchema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('PatchSchema (Closed Grammar)', () => {
    it('accepts valid patch with all six ops', () => {
      const patch = { id: 'patch_abc', baseRevision: 0, ops: [
        { type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} },
        { type: 'update', objectId: 'frame_a', props: { x: 10 } },
        { type: 'delete', objectId: 'frame_x' },
        { type: 'move', objectId: 'frame_a', newParentId: 'frame_new', index: 0 },
        { type: 'lock', objectId: 'frame_b' },
        { type: 'unlock', objectId: 'frame_c' },
      ]}
      const result = PatchSchema.safeParse(patch)
      expect(result.success).toBe(true)
    })

    it('rejects patch with invalid op type', () => {
      const patch = { id: 'patch_abc', baseRevision: 0, ops: [{ type: 'invalid_op', objectId: 'frame_a' }] }
      const result = PatchSchema.safeParse(patch)
      expect(result.success).toBe(false)
    })

    it('rejects patch with extra properties in op', () => {
      const patch = { id: 'patch_abc', baseRevision: 0, ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {}, extra: 'not allowed' }] }
      const result = PatchSchema.safeParse(patch)
      expect(result.success).toBe(false)
    })
  })

  describe('ConfigSchema (Closed Grammar)', () => {
    it('accepts valid config', () => {
      const config = { version: 1, scene: { maxObjects: 500, maxDepth: 10 }, lock: { timeoutMs: 5000, maxRetries: 3 } }
      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('rejects config with extra properties', () => {
      const config = { version: 1, extra: 'not allowed' }
      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })

    it('rejects free-form CSS in config', () => {
      const config = { version: 1, css: { color: 'red', fontSize: 16 } }
      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(false)
    })
  })

  describe('General Closed Grammar Properties', () => {
    it('all schemas reject unknown properties', () => {
      const schemas = [SceneSchema, ObjectTypeSchema, PatchSchema, ConfigSchema]
      for (const schema of schemas) {
        const result = schema.safeParse({ unknownProperty: 'not allowed' })
        expect(result.success).toBe(false)
      }
    })

    it('all schemas reject null where object expected', () => {
      const schemas = [SceneSchema, ObjectTypeSchema, PatchSchema, ConfigSchema]
      for (const schema of schemas) {
        const result = schema.safeParse(null)
        expect(result.success).toBe(false)
      }
    })

    it('all schemas reject arrays where objects expected', () => {
      const schemas = [SceneSchema, ObjectTypeSchema, PatchSchema, ConfigSchema]
      for (const schema of schemas) {
        const result = schema.safeParse([])
        expect(result.success).toBe(false)
      }
    })
  })
})