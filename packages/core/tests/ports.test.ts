import { describe, it, expect } from 'vitest'
import { Clock, IdGenerator, Hasher, FileAdapter } from '../src/ports'

describe('Core: Ports (Clock, IdGenerator, Hasher, FileAdapter)', () => {
  describe('Clock port', () => {
    it('Clock port exists and is a function', () => {
      expect(typeof Clock).toBe('function')
    })

    it('returns now() as number', () => {
      const clock = Clock()
      expect(typeof clock.now).toBe('function')
      expect(typeof clock.now()).toBe('number')
    })
  })

  describe('IdGenerator port', () => {
    it('IdGenerator port exists and is a function', () => {
      expect(typeof IdGenerator).toBe('function')
    })

    it('generates unique IDs', () => {
      const gen = IdGenerator()
      expect(typeof gen.generate).toBe('function')
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(gen.generate('frame'))
      }
      expect(ids.size).toBe(100)
    })
  })

  describe('Hasher port', () => {
    it('Hasher port exists and is a function', () => {
      expect(typeof Hasher).toBe('function')
    })

    it('produces deterministic hashes', () => {
      const hasher = Hasher()
      expect(typeof hasher.hash).toBe('function')
      const obj = { a: 1, b: 2 }
      const hash1 = hasher.hash(obj)
      const hash2 = hasher.hash(obj)
      expect(hash1).toBe(hash2)
      expect(typeof hash1).toBe('string')
    })
  })

  describe('FileAdapter port', () => {
    it('FileAdapter port exists and is a function', () => {
      expect(typeof FileAdapter).toBe('function')
    })

    it('has required methods', () => {
      const adapter = FileAdapter()
      expect(typeof adapter.read).toBe('function')
      expect(typeof adapter.write).toBe('function')
      expect(typeof adapter.delete).toBe('function')
      expect(typeof adapter.list).toBe('function')
      expect(typeof adapter.lock).toBe('function')
      expect(typeof adapter.unlock).toBe('function')
    })
  })
})