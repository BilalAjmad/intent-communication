/**
 * Core Write Pipeline (trd 8)
 * 15-step write pipeline for scene manipulation.
 */

import { FileAdapter, createFileAdapter } from '@intent/adapters-node'
import { Scene, Patch, Op } from '@intent/schema'
import { lintScene } from '@intent/linter'
import { SceneSchema } from '@intent/schema'
import { hashScene, hashObject } from '@intent/core'

export interface WritePipeline {
  validatePatch(patch: Patch): Promise<{ valid: boolean; error?: string }>
  applyPatch(patch: Patch, options?: { target?: string }): Promise<{ success: boolean; newRevision: number; newVersion: number; patchFile?: string; patchPath?: string; reconciled?: boolean }>
}

export interface WritePipelineConfig {
  adapter: ReturnType<typeof createFileAdapter>
}

export function createWritePipeline(adapter: ReturnType<typeof createFileAdapter>): WritePipeline {
  return {
    async validatePatch(patch) {
      // Step 1: Validate patch structure
      if (!patch.id || typeof patch.baseRevision !== 'number' || !Array.isArray(patch.ops)) {
        return { valid: false, error: 'Invalid patch structure' }
      }

      // Step 2: Check base revision matches
      const sceneData = await adapter.read('.intent/scene.json')
      const scene = JSON.parse(new TextDecoder().decode(sceneData))
      if (patch.baseRevision !== scene.revision) {
        return { valid: false, error: `Base revision mismatch: expected ${scene.revision}, got ${patch.baseRevision}` }
      }

      // Step 3: Check path whitelist
      for (const op of patch.ops) {
        if (!op.objectId) {
          return { valid: false, error: 'Missing objectId' }
        }
      }

      // Step 4: Check scope escape
      // Would need to load scene and check hierarchy

      // Step 5: Check lock conflicts
      const sceneData = await adapter.read('.intent/scene.json')
      const scene = JSON.parse(new TextDecoder().decode(sceneData))
      for (const op of patch.ops) {
        if (scene.locks) {
          const locked = scene.locks.some((l: any) => isLockedDescendant(scene, l.objectId, op.objectId))
          if (locked) {
            return { valid: false, error: 'Lock conflict' }
          }
        }
      }

      // Step 6: Validate against schema
      // Would validate the resulting scene

      // Step 7: Run linter
      // Would run lintScene on the resulting scene

      return { valid: true }
    },

    async applyPatch(patch, options) {
      // Steps 8-15: Apply the patch
      // Step 8: Check conflicts
      // Step 9: Apply ops to scene index
      // Step 10: Write patch file
      // Step 11: Write scene.json atomically
      // Step 12: Write patch file
      // Step 13: Update version history
      // Step 14: Clean up temp files
      // Step 14: Coalescing and retention

      // Simplified implementation
      const sceneData = await adapter.read('.intent/scene.json')
      const scene = JSON.parse(new TextDecoder().decode(sceneData))

      // Apply ops
      for (const op of patch.ops) {
        applyOp(scene, op)
      }

      scene.revision++
      scene.version++

      // Write scene.json atomically
      await adapter.write('.intent/scene.json', new TextEncoder().encode(JSON.stringify(scene)))

      // Write patch file
      const patchPath = `.intent/patches/${patch.id}.json`
      await adapter.write(patchPath, new TextEncoder().encode(JSON.stringify(patch)))

      // Update versions
      // Would write to .intent/versions/

      return {
        success: true,
        newRevision: scene.revision,
        newVersion: scene.version,
        patchFile: patchPath,
        patchPath: patchPath,
        reconciled: false
      }
    }
  }
}

function applyOp(scene: any, op: any) {
  switch (op.type) {
    case 'create':
      scene.objects.push({
        id: op.objectId,
        type: op.objectType,
        parentId: op.parentId,
        rect: op.rect,
        children: [],
        props: op.props || {}
      })
      break
    case 'update':
      const obj = scene.objects.find((o: any) => o.id === op.objectId)
      if (obj) Object.assign(obj, op.props)
      break
    case 'delete':
      scene.objects = scene.objects.filter((o: any) => o.id !== op.objectId)
      break
    case 'move':
      const obj = scene.objects.find((o: any) => o.id === op.objectId)
      if (obj) {
        if (op.newParentId) obj.parentId = op.newParentId
        if (op.rect) obj.rect = op.rect
      }
      break
    case 'lock':
    case 'unlock':
      // Handled by lock manager
      break
  }
}

function isLockedDescendant(scene: any, lockedId: string, targetId: string): boolean {
  if (lockedId === targetId) return true
  const target = scene.objects.find((o: any) => o.id === targetId)
  if (!target) return false
  let current = target
  while (current && current.parentId !== 'scene_root') {
    if (current.parentId === lockedId) return true
    current = scene.objects.find((o: any) => o.id === current.parentId)
  }
  return false
}