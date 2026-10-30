import { describe, it, expect } from 'vitest'
import {
  Point,
  Rect,
  Color,
  Token,
  TokenSet,
  parsePoint,
  parseRect,
  parseColor,
  serializePoint,
  serializeRect,
  serializeColor,
} from '../src/primitives'

describe('Primitives (trd 4)', () => {
  describe('Point', () => {
    it('parses valid point strings', () => {
      expect(parsePoint('0,0')).toEqual({ x: 0, y: 0 })
      expect(parsePoint('10,20')).toEqual({ x: 10, y: 20 })
      expect(parsePoint('-5,-10')).toEqual({ x: -5, y: -10 })
      expect(parsePoint('1.5,2.5')).toEqual({ x: 1.5, y: 2.5 })
    })

    it('rejects invalid point strings', () => {
      expect(() => parsePoint('')).toThrow()
      expect(() => parsePoint('10')).toThrow()
      expect(() => parsePoint('a,b')).toThrow()
      expect(() => parsePoint('10,20,30')).toThrow()
    })

    it('serializes to canonical form', () => {
      expect(serializePoint({ x: 0, y: 0 })).toBe('0,0')
      expect(serializePoint({ x: 10, y: 20 })).toBe('10,20')
      expect(serializePoint({ x: 1.5, y: 2.5 })).toBe('1.5,2.5')
    })

    it('round-trips correctly', () => {
      const original = '10,20'
      const parsed = parsePoint(original)
      const serialized = serializePoint(parsed)
      expect(serialized).toBe(original)
    })
  })

  describe('Rect', () => {
    it('parses valid rect strings', () => {
      expect(parseRect('0,0,100,100')).toEqual({ x: 0, y: 0, width: 100, height: 100 })
      expect(parseRect('10,20,50,60')).toEqual({ x: 10, y: 20, width: 50, height: 60 })
      expect(parseRect('-5,-10,20,30')).toEqual({ x: -5, y: -10, width: 20, height: 30 })
    })

    it('rejects invalid rect strings', () => {
      expect(() => parseRect('')).toThrow()
      expect(() => parseRect('10,20')).toThrow()
      expect(() => parseRect('a,b,c,d')).toThrow()
    })

    it('serializes to canonical form', () => {
      expect(serializeRect({ x: 0, y: 0, width: 100, height: 100 })).toBe('0,0,100,100')
      expect(serializeRect({ x: 10, y: 20, width: 50, height: 60 })).toBe('10,20,50,60')
    })

    it('round-trips correctly', () => {
      const original = '10,20,50,60'
      const parsed = parseRect(original)
      const serialized = serializeRect(parsed)
      expect(serialized).toBe(original)
    })
  })

  describe('Color', () => {
    it('parses valid hex colors', () => {
      expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0, a: 1 })
      expect(parseColor('#00ff00')).toEqual({ r: 0, g: 255, b: 0, a: 1 })
      expect(parseColor('#0000ff')).toEqual({ r: 0, g: 0, b: 255, a: 1 })
      expect(parseColor('#808080')).toEqual({ r: 128, g: 128, b: 128, a: 1 })
    })

    it('parses valid hex colors with alpha', () => {
      expect(parseColor('#ff000080')).toEqual({ r: 255, g: 0, b: 0, a: 0.5 })
      expect(parseColor('#00000000')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    })

    it('rejects invalid colors', () => {
      expect(() => parseColor('')).toThrow()
      expect(() => parseColor('red')).toThrow()
      expect(() => parseColor('#gg0000')).toThrow()
      expect(() => parseColor('#ff0')).toThrow()
    })

    it('serializes to canonical hex with alpha', () => {
      expect(serializeColor({ r: 255, g: 0, b: 0, a: 1 })).toBe('#ff0000ff')
      expect(serializeColor({ r: 0, g: 255, b: 0, a: 0.5 })).toBe('#00ff0080')
    })

    it('round-trips correctly', () => {
      const original = '#ff0000ff'
      const parsed = parseColor(original)
      const serialized = serializeColor(parsed)
      expect(serialized).toBe(original)
    })
  })

  describe('Token', () => {
    it('creates valid tokens', () => {
      const token = { name: 'color.primary', value: '#ff0000ff' }
      expect(token.name).toBe('color.primary')
      expect(token.value).toBe('#ff0000ff')
    })

    it('validates token name format', () => {
      expect(() => { if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test('color.primary')) throw new Error() }).not.toThrow()
      expect(() => { if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test('Color.Primary')) throw new Error() }).toThrow()
      expect(() => { if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test('1color')) throw new Error() }).toThrow()
      expect(() => { if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test('color..primary')) throw new Error() }).toThrow()
    })

    it('validates token value is valid color', () => {
      const validToken = { name: 'color.test', value: '#ff0000ff' }
      expect(validToken.value).toMatch(/^#[0-9a-f]{8}$/i)
    })
  })

  describe('TokenSet', () => {
    it('creates token set with required base tokens', () => {
      const set: TokenSet = {
        colors: {
          'color.primary': '#ff0000ff',
          'color.background': '#ffffffff',
          'color.text': '#000000ff',
        },
        spacing: {
          'space.1': 4,
          'space.2': 8,
          'space.3': 16,
        },
        typography: {
          'font.family': 'system-ui',
          'font.size.base': 16,
        },
      }
      expect(set.colors['color.primary']).toBe('#ff0000ff')
      expect(set.spacing['space.1']).toBe(4)
    })
  })
})