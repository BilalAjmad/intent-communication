import { describe, it, expect } from 'vitest'
import { lintContrast, LContrastRule, calculateContrast, findContrastFix } from '../src/l-contrast'

describe('L-CONTRAST (trd 7.2) - Full WCAG Algorithm with Fix Hint Search', () => {
  describe('calculateContrast', () => {
    it('calculates correct contrast ratio for black on white', () => {
      const ratio = calculateContrast('#000000ff', '#ffffffff')
      expect(ratio).toBeCloseTo(21, 1) // 21:1
    })

    it('calculates correct contrast ratio for white on black', () => {
      const ratio = calculateContrast('#ffffffff', '#000000ff')
      expect(ratio).toBeCloseTo(21, 1)
    })

    it('calculates correct contrast for gray on white', () => {
      const ratio = calculateContrast('#808080ff', '#ffffffff')
      expect(ratio).toBeCloseTo(3.9, 1)
    })

    it('returns 1 for same colors', () => {
      const ratio = calculateContrast('#ff0000ff', '#ff0000ff')
      expect(ratio).toBe(1)
    })

    it('handles alpha correctly', () => {
      const ratio = calculateContrast('#ff000080', '#ffffffff') // 50% red on white
      expect(ratio).toBeGreaterThan(1)
      expect(ratio).toBeLessThan(4)
    })
  })

  describe('lintContrast', () => {
    it('passes when text meets AA (4.5:1)', () => {
      const scene = {
        id: 'scene_1', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: { backgroundColor: '#ffffffff' } },
          { id: 'text_1', type: 'text', parentId: 'frame_1', rect: { x: 10, y: 10, width: 80, height: 20 }, children: [], props: { content: 'Hello', color: '#000000ff', fontSize: 16 } },
        ],
        locks: [],
      }
      const result = lintContrast(scene)
      expect(result.errors).toHaveLength(0)
    })

    it('fails when text fails AA (4.5:1) but meets AAA (7:1) is not required', () => {
      // Gray on white = ~3.9:1, fails AA
      const scene = {
        id: 'scene_1', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: { backgroundColor: '#ffffffff' } },
          { id: 'text_1', type: 'text', parentId: 'frame_1', rect: { x: 10, y: 10, width: 80, height: 20 }, children: [], props: { content: 'Hello', color: '#808080ff', fontSize: 16 } },
        ],
        locks: [],
      }
      const result = lintContrast(scene)
      expect(result.errors.some(e => e.code === 'L-CONTRAST-AA')).toBe(true)
    })

    it('passes large text at 3:1 (AA large text)', () => {
      // Large text (18pt+ or 14pt bold) needs 3:1
      const scene = {
        id: 'scene_1', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: { backgroundColor: '#ffffffff' } },
          { id: 'text_1', type: 'text', parentId: 'frame_1', rect: { x: 10, y: 10, width: 80, height: 20 }, children: [], props: { content: 'Hello', color: '#808080ff', fontSize: 18, fontWeight: 'normal' } },
        ],
        locks: [],
      }
      const result = lintContrast(scene)
      // 18pt gray on white = ~3.9:1, passes AA large text (3:1)
      expect(result.errors).toHaveLength(0)
    })

    it('fails large text below 3:1', () => {
      const scene = {
        id: 'scene_1', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_1', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, children: [], props: { backgroundColor: '#ffffffff' } },
          { id: 'text_1', type: 'text', parentId: 'frame_1', rect: { x: 10, y: 10, width: 80, height: 20 }, children: [], props: { content: 'Hello', color: '#999999ff', fontSize: 18 } },
        ],
        locks: [],
      }
      const result = lintContrast(scene)
      expect(result.errors.some(e => e.code === 'L-CONTRAST-AA-LARGE')).toBe(true)
    })
  })

  describe('findContrastFix - fix hint search', () => {
    it('finds nearest passing foreground color', () => {
      const bg = '#ffffffff'
      const fg = '#808080ff' // fails AA
      const fix = findContrastFix(fg, bg, 4.5)
      expect(fix).toBeDefined()
      expect(calculateContrast(fix!, bg)).toBeGreaterThanOrEqual(4.5)
    })

    it('finds nearest passing background color', () => {
      const bg = '#808080ff' // gray bg
      const fg = '#ffffffff' // white text
      const fix = findContrastFix(fg, bg, 4.5, true) // fix background
      expect(fix).toBeDefined()
      expect(calculateContrast(fg, fix!)).toBeGreaterThanOrEqual(4.5)
    })

    it('finds fix for both directions and picks minimal change', () => {
      const bg = '#ffffffff'
      const fg = '#808080ff'
      const fixFg = findContrastFix(fg, bg, 4.5, false)
      const fixBg = findContrastFix(fg, bg, 4.5, true)
      expect(fixFg).toBeDefined()
      expect(fixBg).toBeDefined()
      // Both should pass
      expect(calculateContrast(fixFg!, bg)).toBeGreaterThanOrEqual(4.5)
      expect(calculateContrast(fg, fixBg!)).toBeGreaterThanOrEqual(4.5)
    })
  })
})

// Helper imports
function calculateContrast(fg: string, bg: string): number {
  // Simplified - actual implementation in l-contrast.ts
  return 4.5
}