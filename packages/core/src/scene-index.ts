/**
 * Scene Index - Core scene graph with revision tracking
 */

import { SceneObject } from '@intent/schema'
import { Op } from './ops'

export interface SceneIndex {
  objects: Record<string, SceneObject>
  touched: Set<string>
  rev: number
}

export function createSceneIndex(): SceneIndex {
  return {
    objects: {},
    touched: new Set<string>(),
    rev: 0,
  }
}

export function applyOp(index: { objects: Record<string, any>; touched: Set<string> }, op: any): void {
  switch (op.type) {
    case 'create': {
      const createOp = op as any
      index.objects[createOp.objectId] = {
        id: createOp.objectId,
        type: createOp.objectType,
        parentId: createOp.parentId,
        rect: createOp.rect,
        children: [],
        props: createOp.props || {},
      }
      break
    }
    case 'update': {
      const updateOp = op as any
      if (index.objects[updateOp.objectId]) {
        index.objects[updateOp.objectId] = {
          ...index.objects[updateOp.objectId],
          ...updateOp.props,
        }
      }
      break
    }
    case 'delete': {
      const deleteOp = op as any
      delete index.objects[deleteOp.objectId]
      break
    }
    case 'move': {
      const moveOp = op as any
      if (index.objects[moveOp.objectId]) {
        if (moveOp.newParentId) {
          index.objects[moveOp.objectId].parentId = moveOp.newParentId
        }
        if (moveOp.rect) {
          index.objects[moveOp.objectId].rect = moveOp.rect
        }
      }
      break
    }
    case 'lock':
    case 'unlock': {
      const lockOp = op as any
      // Lock/unlock just touch the object
      break
    }
  }
  index.touched.add(op.objectId)
}

export interface Patch {
  id: string
  baseRevision: number
  ops: any[]
}

export function applyPatch(patch: { ops: any[] }, index: { objects: Record<string, any>; touched: Set<string>; rev: number }): void {
  for (const op of patch.ops) {
    applyOp(index, op)
  }
  index.rev++
}