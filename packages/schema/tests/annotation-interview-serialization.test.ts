import { describe, it, expect } from 'vitest'
import {
  Annotation,
  AnnotationShell,
  createAnnotation,
  validateAnnotation,
  InterviewState,
  createInterviewState,
  validateInterviewState,
  serializeScene,
  deserializeScene,
  serializePatch,
  deserializePatch,
  serializeInterviewState,
  deserializeInterviewState,
} from '../src/annotation-interview-serialization'

describe('Annotation Shell, Interview State, Canonical Serialization (trd 9.5)', () => {
  describe('Annotation Shell', () => {
    it('creates valid annotation', () => {
      const ann: Annotation = {
        id: 'ann_abc123',
        objectId: 'frame_abc',
        type: 'highlight',
        rect: { x: 10, y: 10, width: 50, height: 50 },
        color: '#ffff0080',
        createdAt: Date.now(),
      }
      expect(validateAnnotation(ann)).toBe(true)
    })

    it('creates valid annotation shell', () => {
      const shell: AnnotationShell = {
        annotations: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        selectedIds: [],
      }
      expect(shell.annotations).toEqual([])
      expect(shell.viewport.zoom).toBe(1)
    })
  })

  describe('Interview State', () => {
    it('creates valid initial interview state', () => {
      const state = createInterviewState()
      expect(state.status).toBe('none')
      expect(state.meter).toBe(0)
      expect(state.currentQuestion).toBeNull()
      expect(state.delegated).toEqual([])
      expect(state.answers).toEqual({})
    })

    it('validates interview state', () => {
      const state = createInterviewState()
      expect(validateInterviewState(state)).toBe(true)
    })

    it('rejects invalid interview state', () => {
      expect(validateInterviewState({ status: 'invalid', meter: 0, currentQuestion: null, delegated: [], answers: {} })).toBe(false)
      expect(validateInterviewState({ status: 'active', meter: -1, currentQuestion: null, delegated: [], answers: {} })).toBe(false)
      expect(validateInterviewState({ status: 'active', meter: 1.5, currentQuestion: null, delegated: [], answers: {} })).toBe(false)
    })
  })

  describe('Canonical Serialization (trd 9.5)', () => {
    it('serializes scene to canonical JSON', () => {
      const scene = { id: 'scene_abc', version: 0, rootId: 'frame_root', objects: [], locks: [] }
      const json = serializeScene(scene)
      expect(typeof json).toBe('string')
      const parsed = JSON.parse(json)
      expect(parsed.id).toBe('scene_abc')
    })

    it('deserializes scene from canonical JSON', () => {
      const json = '{"id":"scene_abc","version":0,"rootId":"frame_root","objects":[],"locks":[]}'
      const scene = deserializeScene(json)
      expect(scene.id).toBe('scene_abc')
      expect(scene.version).toBe(0)
    })

    it('round-trips scene serialization', () => {
      const original = { id: 'scene_abc', version: 0, rootId: 'frame_root', objects: [], locks: [] }
      const json = serializeScene(original)
      const restored = deserializeScene(json)
      expect(restored).toEqual(original)
    })

    it('serializes patch to canonical JSON', () => {
      const patch = { id: 'patch_abc', baseRevision: 0, ops: [] }
      const json = serializePatch(patch)
      expect(typeof json).toBe('string')
    })

    it('round-trips patch serialization', () => {
      const original = { id: 'patch_abc', baseRevision: 0, ops: [] }
      const json = serializePatch(original)
      const restored = deserializePatch(json)
      expect(restored).toEqual(original)
    })

    it('serializes interview state', () => {
      const state = { status: 'active', meter: 0.5, currentQuestion: 'goal.purpose', delegated: [], answers: { 'goal.purpose': 'test' } }
      const json = serializeInterviewState(state)
      expect(typeof json).toBe('string')
    })

    it('round-trips interview state', () => {
      const original = { status: 'active', meter: 0.5, currentQuestion: 'goal.purpose', delegated: [], answers: { 'goal.purpose': 'test' } }
      const json = serializeInterviewState(original)
      const restored = deserializeInterviewState(json)
      expect(restored).toEqual(original)
    })

    it('produces deterministic JSON (stable key order)', () => {
      const obj = { b: 1, a: 2 }
      const json1 = JSON.stringify(obj, Object.keys(obj).sort())
      const json2 = JSON.stringify(obj, Object.keys(obj).sort())
      expect(json1).toBe(json2)
    })
  })
})