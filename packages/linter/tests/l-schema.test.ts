import { describe, it, expect } from 'vitest'
import { lintSchema, LSchemaRule } from '../src/l-schema'

describe('L-SCHEMA (trd 7.1)', () => {
  it('passes valid scene', () => {
    const scene = { id: 'scene_1', version: 1, rootId: 'frame_root', objects: [], locks: [] }
    const result = lintSchema(scene)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('fails on missing required fields', () => {
    const scene = { id: 'scene_1' }
    const result = lintSchema(scene)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors.some(e => e.code === 'L-SCHEMA-MISSING')).toBe(true)
  })

  it('fails on invalid object type', () => {
    const scene = { id: 'scene_1', version: 1, rootId: 'frame_root', objects: [{ id: 'frame_1', type: 'div', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} }], locks: [] }
    const result = lintSchema(scene)
    expect(result.errors.some(e => e.code === 'L-SCHEMA-TYPE')).toBe(true)
  })

  it('fails on duplicate IDs', () => {
    const scene = { id: 'scene_1', version: 1, rootId: 'frame_root', objects: [{ id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} }, { id: 'frame_1', type: 'text', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} }], locks: [] }
    const result = lintSchema(scene)
    expect(result.errors.some(e => e.code === 'L-SCHEMA-DUPLICATE')).toBe(true)
  })

  it('fails on invalid parent reference', () => {
    const scene = { id: 'scene_1', version: 1, rootId: 'frame_root', objects: [{ id: 'frame_1', type: 'frame', parentId: 'nonexistent', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} }], locks: [] }
    const result = lintSchema(scene)
    expect(result.errors.some(e => e.code === 'L-SCHEMA-PARENT')).toBe(true)
  })

  it('fails on cycle in hierarchy', () => {
    const scene = { id: 'scene_1', version: 1, rootId: 'frame_root', objects: [{ id: 'frame_a', type: 'frame', parentId: 'frame_b', rect: { x: 0, y: 0, width: 100, height: 100 }, children: ['frame_b'], props: {} }, { id: 'frame_b', type: 'frame', parentId: 'frame_a', rect: { x: 0, y: 0, width: 100, height: 100 }, children: ['frame_a'], props: {} }], locks: [] }
    const result = lintSchema(scene)
    expect(result.errors.some(e => e.code === 'L-SCHEMA-CYCLE')).toBe(true)
  })
})