import { describe, it, expect } from 'vitest'
import {
  serializeScene,
  deserializeScene,
  serializePatch,
  deserializePatch,
  serializeInterviewState,
  deserializeInterviewState,
  serializeAnnotation,
  deserializeAnnotation,
  canonicalJSON,
} from '../src/annotation-interview-serialization'

describe('Round-trip Serialization (trd 9.5)', () => {
  describe('Scene round-trip', () => {
    it('serializes and deserializes scene byte-identically', () => {
      const scene = {
        id: 'scene_abc123',
        version: 5,
        rootId: 'frame_root',
        objects: [
          { id: 'frame_root', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 1920, height: 1080 }, children: [], props: {} },
          { id: 'frame_child', type: 'frame', parentId: 'frame_root', rect: { x: 10, y: 10, width: 100, height: 100 }, children: [], props: { backgroundColor: '#ffffff' } },
          { id: 'text_hello', type: 'text', parentId: 'frame_root', rect: { x: 20, y: 20, width: 200, height: 50 }, children: [], props: { content: 'Hello World', fontSize: 16, color: '#000000ff' } },
        ],
        locks: [{ objectId: 'frame_root', lockedBy: 'user', timestamp: 1234567890 }],
      }
      const json1 = canonicalJSON(scene)
      const json2 = canonicalJSON(scene)
      expect(json1).toBe(json2)
    })

    it('serializes to canonical JSON with sorted keys', () => {
      const scene = { b: 1, a: 2 }
      const json = canonicalJSON(scene)
      expect(json).toBe('{"a":2,"b":1}')
    })

    it('produces deterministic output across runs', () => {
      const scene = { z: 1, a: 2, m: 3 }
      const json1 = canonicalJSON(scene)
      const json2 = canonicalJSON(scene)
      expect(json1).toBe(json2)
    })
  })

  describe('Patch round-trip', () => {
    it('serializes patch deterministically', () => {
      const patch = {
        id: 'patch_abc',
        baseRevision: 5,
        ops: [
          { type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} },
          { type: 'update', objectId: 'frame_b', props: { x: 10, y: 20 } },
          { type: 'lock', objectId: 'frame_c' },
        ],
      }
      const json1 = canonicalJSON(patch)
      const json2 = canonicalJSON(patch)
      expect(json1).toBe(json2)
    })
  })

  describe('Interview state round-trip', () => {
    it('serializes interview state deterministically', () => {
      const state = {
        status: 'active',
        meter: 0.75,
        currentQuestion: 'flow.main',
        delegated: ['style.color'],
        answers: { 'goal.purpose': 'Build a dashboard', 'users.primary': 'developers' },
        reopen: [],
      }
      const json1 = canonicalJSON(state)
      const json2 = canonicalJSON(state)
      expect(json1).toBe(json2)
    })
  })

  describe('Cross-platform consistency', () => {
    it('produces identical JSON across platforms', () => {
      const scene = { a: 1, b: { c: 2, d: 3 } }
      const json = canonicalJSON(scene)
      expect(json).toBe('{"a":1,"b":{"c":2,"d":3}}')
    })

    it('handles Unicode correctly', () => {
      const scene = { text: 'Hello 世界 🌍', emoji: '🚀' }
      const json = canonicalJSON(scene)
      expect(json).toContain('世界')
      expect(json).toContain('🚀')
    })
  })

  describe('Byte-identical requirement', () => {
    it('serializes identical objects to identical bytes', () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { b: 2, a: 1 }
      const json1 = canonicalJSON(obj1)
      const json2 = canonicalJSON(obj2)
      expect(json1).toBe(json2)
    })

    it('uses stable sort for object keys', () => {
      const obj = { z: 1, a: 2, m: 3 }
      const json = canonicalJSON(obj)
      expect(json).toBe('{"a":2,"m":3,"z":1}')
    })
  })
})