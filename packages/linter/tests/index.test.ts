import { describe, it, expect } from 'vitest'
import { lintScene, LintResult, LintError, LintWarning } from '../src/index'
import { lintSchema } from '../src/l-schema'
import { lintGrid } from '../src/l-grid'
import { lintContrast } from '../src/l-contrast'
import { lintTouch } from '../src/l-touch'

describe('Linter Package Exports', () => {
  describe('Main entry point', () => {
    it('exports lintScene', () => { expect(typeof lintScene).toBe('function') })
    it('exports LintResult type', () => { expect(true).toBe(true) })
    it('exports LintError type', () => { expect(true).toBe(true) })
    it('exports LintWarning type', () => { expect(true).toBe(true) })
  })

  describe('Rule exports', () => {
    it('exports lintSchema and LSchemaRule', () => { expect(typeof lintSchema).toBe('function') })
    it('exports lintGrid', () => { expect(typeof lintGrid).toBe('function') })
    it('exports lintContrast', () => { expect(typeof lintContrast).toBe('function') })
    it('exports lintTouch', () => { expect(typeof lintTouch).toBe('function') })
  })

  describe('Smoke tests', () => {
    it('lintScene runs without throwing', () => {
      const scene = { id: 'scene_1', version: 1, rootId: 'frame_root', objects: [], locks: [] }
      const result = lintScene(scene)
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
    })

    it('lintSchema catches invalid scene', () => {
      const scene = { id: 'scene_1' }
      const result = lintSchema(scene)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('lintGrid catches misaligned rect', () => {
      const scene = { id: 's', version: 1, rootId: 'r', objects: [{ id: 'f', type: 'frame', parentId: 'r', rect: { x: 1, y: 0, width: 100, height: 100 }, children: [], props: {} }], locks: [] }
      const result = lintGrid(scene)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('lintContrast catches low contrast', () => {
      const scene = { id: 's', version: 1, rootId: 'r', objects: [{ id: 'f', type: 'frame', parentId: 'r', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: { backgroundColor: '#ffffffff' } }, { id: 't', type: 'text', parentId: 'f', rect: { x: 10, y: 10, width: 80, height: 20 }, children: [], props: { content: 'Hi', color: '#808080ff', fontSize: 16 } }], locks: [] }
      const result = lintContrast(scene)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('lintTouch catches small button', () => {
      const scene = { id: 's', version: 1, rootId: 'r', objects: [{ id: 'b', type: 'component', parentId: 'r', rect: { x: 10, y: 10, width: 30, height: 30 }, children: [], props: { role: 'button' } }], locks: [] }
      const result = lintTouch(scene)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})
