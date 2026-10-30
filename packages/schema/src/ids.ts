/**
 * IDs (trd 3)
 * Unique identifiers for all entities in the Intent system.
 */

export const ID_REGEX = /^[a-z][a-z0-9]*_[a-z0-9]+$/

export type SchemaId = string & { readonly __brand: unique symbol }
export type SceneId = string & { readonly __brand: unique symbol }
export type PatchId = string & { readonly __brand: unique symbol }

export const ID_PREFIXES = {
  scene: 'scene',
  frame: 'frame',
  text: 'text',
  image: 'image',
  vector: 'vector',
  component: 'component',
  patch: 'patch',
  version: 'version',
  lock: 'lock',
  annotation: 'ann',
  interview: 'intv',
} as const

export type IdPrefix = typeof ID_PREFIXES[keyof typeof ID_PREFIXES]

let idCounter = 0

export function generateId(prefix: IdPrefix): string {
  const timestamp = Date.now().toString(36)
  const counter = (idCounter++).toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}_${timestamp}${counter}${random}`
}

export function validateId(id: string): boolean {
  return ID_REGEX.test(id)
}

export function extractPrefix(id: string): string | null {
  const match = id.match(/^([a-z][a-z0-9]*)_/)
  return match ? match[1] : null
}

export function isValidPrefix(prefix: string): prefix is IdPrefix {
  return Object.values(ID_PREFIXES).includes(prefix as IdPrefix)
}