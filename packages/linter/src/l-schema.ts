/**
 * L-SCHEMA - Schema Validation (trd 7.1)
 * Validates scene structure against schema.
 */

import { SceneSchema } from '@intent/schema'

export interface LSchemaRule {
  name: 'L-SCHEMA'
}

export function lintSchema(scene: any): { errors: any[]; warnings: any[] } {
  const errors: any[] = []
  const warnings: any[] = []

  // Check required fields
  if (!scene.id || typeof scene.id !== 'string') {
    errors.push({ code: 'L-SCHEMA-MISSING', message: 'Scene missing required id', path: 'id' })
  }
  if (typeof scene.version !== 'number') {
    errors.push({ code: 'L-SCHEMA-MISSING', message: 'Scene missing required version', path: 'version' })
  }
  if (!scene.rootId || typeof scene.rootId !== 'string') {
    errors.push({ code: 'L-SCHEMA-MISSING', message: 'Scene missing required rootId', path: 'rootId' })
  }
  if (!Array.isArray(scene.objects)) {
    errors.push({ code: 'L-SCHEMA-MISSING', message: 'Scene missing required objects array', path: 'objects' })
  }
  if (!Array.isArray(scene.locks)) {
    errors.push({ code: 'L-SCHEMA-MISSING', message: 'Scene missing required locks array', path: 'locks' })
  }

  // Use schema for detailed validation
  if (errors.length === 0) {
    const result = SceneSchema.safeParse(scene)
    if (!result.success) {
      for (const issue of result.error.errors) {
        errors.push({
          code: 'L-SCHEMA',
          message: issue.message,
          path: issue.path.join('.'),
        })
      }
    }
  }

  // Additional checks not covered by schema
  if (errors.length === 0 && scene.objects) {
    // Check for duplicate IDs
    const ids = new Set<string>()
    for (const obj of scene.objects) {
      if (ids.has(obj.id)) {
        errors.push({ code: 'L-SCHEMA-DUPLICATE', message: `Duplicate object ID: ${obj.id}`, objectId: obj.id })
      }
      ids.add(obj.id)
    }

    // Check for invalid parent references
    const objectIds = new Set(scene.objects.map((o: any) => o.id))
    objectIds.add('scene_root')
    for (const obj of scene.objects) {
      if (!objectIds.has(obj.parentId)) {
        errors.push({ code: 'L-SCHEMA-PARENT', message: `Invalid parent reference: ${obj.parentId}`, objectId: obj.id })
      }
    }

    // Check for cycles
    for (const obj of scene.objects) {
      const visited = new Set<string>()
      let current = obj.parentId
      while (current !== 'scene_root') {
        if (visited.has(current)) {
          errors.push({ code: 'L-SCHEMA-CYCLE', message: 'Cycle detected in hierarchy', objectId: obj.id })
          break
        }
        visited.add(current)
        const parent = scene.objects.find((o: any) => o.id === current)
        if (!parent) break
        current = parent.parentId
      }
    }
  }

  return { errors, warnings: [] }
}