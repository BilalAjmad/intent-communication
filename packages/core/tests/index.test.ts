import { describe, it, expect } from 'vitest'
import {
  Clock,
  IdGenerator,
  Hasher,
  FileAdapter,
} from '../src/ports'
import { SceneIndex, createSceneIndex, applyOp, applyPatch } from '../src/scene-index'
import { checkPathWhitelist, checkScopeEscape, checkMoveOutOfSubtree, checkRemoveWithLockedDescendant, checkLockInheritance } from '../src/security'
import { hashScene, hashObject } from '../src/hashing'

describe('Core Package Exports', () => {
  describe('Ports', () => {
    it('exports Clock', () => { expect(typeof Clock).toBe('function') })
    it('exports IdGenerator', () => { expect(typeof IdGenerator).toBe('function') })
    it('exports Hasher', () => { expect(typeof Hasher).toBe('function') })
    it('exports FileAdapter', () => { expect(typeof FileAdapter).toBe('function') })
  })

  describe('Scene Index', () => {
    it('exports SceneIndex', () => { expect(typeof SceneIndex).toBe('object') })
    it('exports createSceneIndex', () => { expect(typeof createSceneIndex).toBe('function') })
    it('exports applyOp', () => { expect(typeof applyOp).toBe('function') })
    it('exports applyPatch', () => { expect(typeof applyPatch).toBe('function') })
  })

  describe('Security', () => {
    it('exports checkPathWhitelist', () => { expect(typeof checkPathWhitelist).toBe('function') })
    it('exports checkScopeEscape', () => { expect(typeof checkScopeEscape).toBe('function') })
    it('exports checkMoveOutOfSubtree', () => { expect(typeof checkMoveOutOfSubtree).toBe('function') })
    it('exports checkRemoveWithLockedDescendant', () => { expect(typeof checkRemoveWithLockedDescendant).toBe('function') })
    it('exports checkLockInheritance', () => { expect(typeof checkLockInheritance).toBe('function') })
  })

  describe('Hashing', () => {
    it('exports hashScene', () => { expect(typeof hashScene).toBe('function') })
    it('exports hashObject', () => { expect(typeof hashObject).toBe('function') })
  })

  describe('Smoke Tests', () => {
    it('Clock produces number', () => { expect(typeof Clock().now()).toBe('number') })
    it('IdGenerator produces unique IDs', () => { 
      const gen = require('../src/ports').IdGenerator()
      const ids = new Set()
      for (let i = 0; i < 10; i++) ids.add(gen.generate('frame'))
      expect(ids.size).toBe(10)
    })
    it('Hasher produces deterministic hash', () => {
      const hasher = require('../src/ports').Hasher()
      const h1 = hasher.hash({ a: 1 })
      const h2 = hasher.hash({ a: 1 })
      expect(h1).toBe(h2)
    })
    it('FileAdapter has required methods', () => {
      const adapter = require('../src/ports').FileAdapter()
      expect(typeof adapter.read).toBe('function')
      expect(typeof adapter.write).toBe('function')
    })
    it('SceneIndex creates empty index', () => {
      const index = require('../src/scene-index').createSceneIndex()
      expect(index.objects).toEqual({})
      expect(index.touched.size).toBe(0)
      expect(index.rev).toBe(0)
    })
    it('checkPathWhitelist allows .intent/', () => {
      expect(require('../src/security').checkPathWhitelist('.intent/scene.json')).toBe(true)
      expect(require('../src/security').checkPathWhitelist('/etc/passwd')).toBe(false)
    })
    it('hashScene produces deterministic hash', () => {
      const scene = { id: 'scene_1', version: 0, objects: {}, locks: [] }
      expect(require('../src/hashing').hashScene(scene)).toBe(require('../src/hashing').hashScene(scene))
    })
  })
})
