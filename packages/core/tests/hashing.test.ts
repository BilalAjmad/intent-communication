import { describe, it, expect } from 'vitest'
import { hashScene, hashObject } from '../src/hashing'

describe('Hashing Helpers', () => {
  it('hashScene produces deterministic hash', () => {
    const scene = { id: 'scene_1', version: 1, objects: {}, locks: [] }
    const hash1 = hashScene(scene)
    const hash2 = hashScene(scene)
    expect(hash1).toBe(hash2)
    expect(typeof hash1).toBe('string')
    expect(hash1.length).toBeGreaterThan(0)
  })

  it('hashObject produces deterministic hash', () => {
    const obj = { id: 'frame_1', type: 'frame', rect: { x: 0, y: 0, width: 100, height: 100 } }
    const hash1 = hashObject(obj)
    const hash2 = hashObject(obj)
    expect(hash1).toBe(hash2)
  })

  it('different objects produce different hashes', () => {
    const obj1 = { id: 'a', x: 1 }
    const obj2 = { id: 'b', x: 1 }
    expect(hashObject(obj1)).not.toBe(hashObject(obj2))
  })
})