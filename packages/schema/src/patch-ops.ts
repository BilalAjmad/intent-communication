/**
 * Patch and Ops (trd 6)
 * Core patch operations for scene manipulation.
 */

export type OpType = 'create' | 'update' | 'delete' | 'move' | 'lock' | 'unlock'

export interface BaseOp {
  type: OpType
  objectId: string
}

export interface CreateOp extends BaseOp {
  type: 'create'
  objectType: 'frame' | 'text' | 'image' | 'vector' | 'component'
  parentId: string
  rect: { x: number; y: number; width: number; height: number }
  props: Record<string, unknown>
}

export interface UpdateOp extends BaseOp {
  type: 'update'
  props: Record<string, unknown>
}

export interface DeleteOp extends BaseOp {
  type: 'delete'
}

export interface MoveOp extends BaseOp {
  type: 'move'
  newParentId?: string
  rect?: { x: number; y: number; width: number; height: number }
  index?: number
}

export interface LockOp extends BaseOp {
  type: 'lock'
}

export interface UnlockOp extends BaseOp {
  type: 'unlock'
}

export type Op = CreateOp | UpdateOp | DeleteOp | MoveOp | LockOp | UnlockOp

export interface Patch {
  id: string
  baseRevision: number
  ops: Op[]
}

export const OP_TYPES: OpType[] = ['create', 'update', 'delete', 'move', 'lock', 'unlock']

export function isValidOpType(type: string): type is OpType {
  return ['create', 'update', 'delete', 'move', 'lock', 'unlock'].includes(type)
}

let patchCounter = 0

export function createPatch(ops: Op[]): Patch {
  return {
    id: `patch_${Date.now().toString(36)}_${(patchCounter++).toString(36)}`,
    baseRevision: 0, // Will be set by caller
    ops,
  }
}

export function validatePatch(patch: Patch): boolean {
  if (!patch.id || typeof patch.baseRevision !== 'number' || !Array.isArray(patch.ops)) {
    return false
  }
  for (const op of patch.ops) {
    if (!op.type || !isValidOpType(op.type) || !op.objectId) {
      return false
    }
    if (op.type === 'create') {
      const createOp = op as any
      if (!createOp.objectType || !createOp.parentId || !createOp.rect || !createOp.props) {
        return false
      }
    }
    if (op.type === 'update') {
      const updateOp = op as any
      if (!updateOp.props || typeof updateOp.props !== 'object') {
        return false
      }
    }
    if (op.type === 'move') {
      const moveOp = op as any
      if (!moveOp.newParentId && !moveOp.rect && moveOp.index === undefined) {
        return false
      }
    }
  }
  return true
}

export function isValidOpType(type: string): type is OpType {
  return ['create', 'update', 'delete', 'move', 'lock', 'unlock'].includes(type)
}

export type CreateOp = {
  type: 'create'
  objectId: string
  objectType: 'frame' | 'text' | 'image' | 'vector' | 'component'
  parentId: string
  rect: { x: number; y: number; width: number; height: number }
  props: Record<string, unknown>
}

export type UpdateOp = {
  type: 'update'
  objectId: string
  props: Record<string, unknown>
}

export type DeleteOp = {
  type: 'delete'
  objectId: string
}

export type MoveOp = {
  type: 'move'
  objectId: string
  newParentId?: string
  rect?: { x: number; y: number; width: number; height: number }
  index?: number
}

export type LockOp = {
  type: 'lock'
  objectId: string
}

export type UnlockOp = {
  type: 'unlock'
  objectId: string
}

export type Op = CreateOp | UpdateOp | DeleteOp | MoveOp | LockOp | UnlockOp

export type OpType = CreateOp['type'] | UpdateOp['type'] | DeleteOp['type'] | MoveOp['type'] | LockOp['type'] | UnlockOp['type']

export interface Patch {
  id: string
  baseRevision: number
  ops: Op[]
}