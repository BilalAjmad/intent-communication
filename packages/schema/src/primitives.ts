/**
 * Primitives (trd 4)
 * Core primitive types: Point, Rect, Color, Token, TokenSet
 */

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Color {
  r: number
  g: number
  b: number
  a: number // 0-1
}

export interface Token {
  name: string
  value: string // hex color #rrggbbaa
}

export interface TokenSet {
  colors: Record<string, string> // #rrggbbaa
  spacing: Record<string, number>
  typography: Record<string, string | number>
}

/**
 * Parses point string "x,y" to Point object
 */
export function parsePoint(str: string): Point {
  const parts = str.split(',')
  if (parts.length !== 2) throw new Error(`Invalid point: ${str}`)
  const x = parseFloat(parts[0])
  const y = parseFloat(parts[1])
  if (isNaN(x) || isNaN(y)) throw new Error(`Invalid point coordinates: ${str}`)
  return { x, y }
}

/**
 * Serializes Point to canonical "x,y" string
 */
export function serializePoint(point: Point): string {
  return `${point.x},${point.y}`
}

/**
 * Parses rect string "x,y,width,height" to Rect object
 */
export function parseRect(str: string): Rect {
  const parts = str.split(',')
  if (parts.length !== 4) throw new Error(`Invalid rect: ${str}`)
  const [x, y, width, height] = parts.map(parseFloat)
  if (parts.some(p => isNaN(parseFloat(p)))) throw new Error(`Invalid rect coordinates: ${str}`)
  if (width < 0 || height < 0) throw new Error(`Rect width/height must be non-negative`)
  return { x, y, width, height }
}

/**
 * Serializes Rect to canonical "x,y,width,height" string
 */
export function serializeRect(rect: Rect): string {
  return `${rect.x},${rect.y},${rect.width},${rect.height}`
}

/**
 * Parses hex color string to Color object
 * Supports #rrggbb, #rrggbbaa only (trd 4.1)
 * 3-digit (#rgb) and 4-digit (#rgba) are NOT supported
 */
export function parseColor(str: string): Color {
  if (!str.startsWith('#')) throw new Error(`Invalid color format: ${str}`)
  const hex = str.slice(1)
  const validHex = /^[0-9a-f]+$/i
  if (!validHex.test(hex)) throw new Error(`Invalid color format: ${str}`)
  
  // Only 6-digit (#rrggbb) and 8-digit (#rrggbbaa) are valid per trd 4.1
  if (hex.length === 6) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    }
  }
  if (hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: parseInt(hex.slice(6, 8), 16) / 255,
    }
  }
  throw new Error(`Invalid color format: ${str}`)
}

/**
 * Serializes Color to canonical #rrggbbaa hex string
 */
export function serializeColor(color: Color): string {
  const r = Math.round(Math.max(0, Math.min(255, color.r))).toString(16).padStart(2, '0')
  const g = Math.round(Math.max(0, Math.min(255, color.g))).toString(16).padStart(2, '0')
  const b = Math.round(Math.max(0, Math.min(255, color.b))).toString(16).padStart(2, '0')
  const a = Math.round(Math.max(0, Math.min(1, color.a)) * 255).toString(16).padStart(2, '0')
  return `#${r}${g}${b}${a}`
}

export interface Token {
  name: string
  value: string
}

export interface TokenSet {
  colors: Record<string, string>
  spacing: Record<string, number>
  typography: Record<string, string | number>
}

const TOKEN_NAME_REGEX = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/
const COLOR_HEX_REGEX = /^#[0-9a-f]{8}$/i

export function validateTokenName(name: string): boolean {
  return TOKEN_NAME_REGEX.test(name)
}

export function validateTokenValue(value: string): boolean {
  return COLOR_HEX_REGEX.test(value)
}