import { describe, it, expect } from 'vitest'
import { lintGrid, LGridRule } from '../src/l-grid'

describe('L-GRID (trd 7.2) - 4px grid, 8px warn', () => {
  it('passes when all rects align to 4px grid', () => {
    const scene = {
      id: 'scene_1', version: 1, rootId: 'frame_root',
      objects: [
        { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: {} },
        { id: 'frame_2', type: 'frame', parentId: 'frame_1', rect: { x: 4, y: 8, width: 92, height: 84 }, children: [], props: {} },
      ],
      locks: [],
    }
    const result = lintGrid(scene)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('fails when x not aligned to 4px', () => {
    const scene = {
      id: 'scene_1', version: 1, rootId: 'frame_root',
      objects: [{ id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 1, y: 0, width: 100, height: 100 }, children: [], props: {} }],
      locks: [],
    }
    const result = lintGrid(scene)
    expect(result.errors.some(e => e.code === 'L-GRID-X')).toBe(true)
  })

  it('fails when y not aligned to 4px', () => {
    const scene = {
      id: 'scene_1', version: 1, rootId: 'frame_root',
      objects: [{ id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 1, width: 100, height: 100 }, children: [], props: {} }],
      locks: [],
    }
    const result = lintGrid(scene)
    expect(result.errors.some(e => e.code === 'L-GRID-Y')).toBe(true)
  })

  it('fails when width not aligned to 4px', () => {
    const scene = {
      id: 'scene_1', version: 1, rootId: 'frame_root',
      objects: [{ id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 101, height: 100 }, children: [], props: {} }],
      locks: [],
    }
    const result = lintGrid(scene)
    expect(result.errors.some(e => e.code === 'L-GRID-WIDTH')).toBe(true)
  })

  it('fails when height not aligned to 4px', () => {
    const scene = {
      id: 'scene_1', version: 1, rootId: 'frame_root',
      objects: [{ id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 101 }, children: [], props: {} }],
      locks: [],
    }
    const result = lintGrid(scene)
    expect(result.errors.some(e => e.code === 'L-GRID-HEIGHT')).toBe(true)
  })

  it('warns when rect aligns to 4px but not 8px', () => {
    const scene = {
      id: 'scene_1', version: 1, rootId: 'frame_root',
      objects: [{ id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 4, y: 4, width: 100, height: 100 }, children: [], props: {} }],
      locks: [],
    }
    const result = lintGrid(scene)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings.some(w => w.code === 'L-GRID-WARN-8PX')).toBe(true)
  })

  it('passes when rect aligns to 8px', () => {
    const scene = {
      id: 'scene_1', version: 1, rootId: 'frame_root',
      objects: [{ id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 8, y: 8, width: 96, height: 96 }, children: [], props: {} }],
      locks: [],
    }
    const result = lintGrid(scene)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })
})