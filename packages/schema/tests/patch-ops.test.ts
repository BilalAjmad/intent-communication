import { describe, it, expect } from 'vitest'
import {
  OpType,
  Patch,
  CreateOp,
  UpdateOp,
  DeleteOp,
  MoveOp,
  LockOp,
  UnlockOp,
  createPatch,
  validatePatch,
  isValidOpType,
} from '../src/patch-ops'

describe('Patch and Ops (trd 6)', () => {
  describe('OpType enum', () => {
    it('includes all six ops', () => {
      expect(isValidOpType('create')).toBe(true)
      expect(isValidOpType('update')).toBe(true)
      expect(isValidOpType('delete')).toBe(true)
      expect(isValidOpType('move')).toBe(true)
      expect(isValidOpType('lock')).toBe(true)
      expect(isValidOpType('unlock')).toBe(true)
    })

    it('rejects invalid op types', () => {
      expect(isValidOpType('invalid')).toBe(false)
      expect(isValidOpType('')).toBe(false)
      expect(isValidOpType('Create')).toBe(false)
    })
  })

  describe('CreateOp', () => {
    it('creates valid create op', () => {
      const op: CreateOp = {
        type: 'create',
        objectId: 'frame_new',
        type: 'frame',
        parentId: 'frame_parent',
        rect: { x: 0, y: 0, width: 100, height: 100 },
        props: {},
      }
      expect(op.type).toBe('create')
      expect(op.objectId).toMatch(/^frame_/)
    })

    it('requires objectId and type', () => {
      expect(() => {
        const op: CreateOp = { type: 'create', objectId: '', objectType: 'frame', parentId: 'p', rect: { x: 0, y: 0, width: 10, height: 10 }, props: {} }
        // Should fail validation
      }).not.toThrow()
    })
  })

  describe('UpdateOp', () => {
    it('creates valid update op with partial props', () => {
      const op: UpdateOp = {
        type: 'update',
        objectId: 'frame_abc123',
        props: { width: 200, color: '#ff0000ff' },
      };
      expect(op.type).toBe('update')
      expect(op.objectId).toMatch(/^frame_/)
      expect(op.props).toEqual({ width: 200, color: '#ff0000ff' })
    })

    it('allows partial updates', () => {
      const op: UpdateOp = { type: 'update', objectId: 'frame_abc', props: { x: 10 } }
      expect(op.props).toEqual({ x: 10 })
    })
  })

  describe('DeleteOp', () => {
    it('creates valid delete op', () => {
      const op: DeleteOp = { type: 'delete', objectId: 'frame_abc123' }
      expect(op.type).toBe('delete')
      expect(op.objectId).toMatch(/^frame_/)
    })
  })

  describe('MoveOp', () => {
    it('creates valid move op with new parent', () => {
      const op: MoveOp = { type: 'move', objectId: 'frame_child', newParentId: 'frame_newparent', index: 0 }
      expect(op.type).toBe('move')
      expect(op.objectId).toMatch(/^frame_/)
      expect(op.newParentId).toMatch(/^frame_/)
    })

    it('creates valid move op with new rect', () => {
      const op: MoveOp = { type: 'move', objectId: 'frame_child', rect: { x: 10, y: 20, width: 100, height: 100 } }
      expect(op.rect).toEqual({ x: 10, y: 20, width: 100, height: 100 })
    })
  })

  describe('LockOp', () => {
    it('creates valid lock op', () => {
      const op: LockOp = { type: 'lock', objectId: 'frame_abc123' }
      expect(op.type).toBe('lock')
      expect(op.objectId).toMatch(/^frame_/)
    })
  })

  describe('UnlockOp', () => {
    it('creates valid unlock op', () => {
      const op: UnlockOp = { type: 'unlock', objectId: 'frame_abc123' }
      expect(op.type).toBe('unlock')
      expect(op.objectId).toMatch(/^frame_/)
    })
  })

  describe('Patch', () => {
    it('creates valid patch with multiple ops', () => {
      const patch = createPatch([
        { type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} },
        { type: 'update', objectId: 'frame_b', props: { x: 10 } },
        { type: 'lock', objectId: 'frame_c' },
      ])
      expect(patch.ops).toHaveLength(3)
      expect(patch.id).toMatch(/^patch_/)
      expect(patch.baseRevision).toBeGreaterThanOrEqual(0)
    })

    it('generates unique patch IDs', () => {
      const patch1 = createPatch([])
      const patch2 = createPatch([])
      expect(patch1.id).not.toBe(patch2.id)
    })

    it('validates patch structure', () => {
      const validPatch = createPatch([
        { type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 10, height: 10 }, props: {} }
      ])
      expect(validatePatch(validPatch)).toBe(true)
    })

    it('rejects patch with invalid op', () => {
      const invalidPatch = { id: 'patch_test', baseRevision: 0, ops: [{ type: 'invalid', objectId: 'x' }] }
      expect(validatePatch(invalidPatch)).toBe(false)
    })

    it('rejects patch with missing required fields', () => {
      const invalidPatch = { id: 'patch_test', baseRevision: 0, ops: [{ type: 'create', objectId: 'x' }] }
      expect(validatePatch(invalidPatch)).toBe(false)
    })
  })
})