/**
 * Layout Resolver (trd 7.2)
 * Resolves layout constraints and computes derived positions.
 */

import { Scene, SceneObject, Rect } from '@intent/schema'

export interface LayoutResolver {
  resolve(scene: Scene): Scene
}

/**
 * Resolves layout constraints and computes final positions.
 * This is a placeholder for the full layout resolver implementation.
 */
export function resolveLayout(scene: any): any {
  // For now, just return the scene as-is
  // Full implementation would:
  // 1. Resolve flex/grid layouts
  // 2. Compute auto-sized dimensions
  // 3. Resolve percentage-based positions
  // 4. Handle absolute positioning
  // 5. Handle constraints (min/max width/height)
  return scene
}

/**
 * Merge themes deterministically
 */
export function mergeThemes(base: any, user: any): any {
  const result: any = { ...base }
  for (const key of Object.keys(user)) {
    if (typeof user[key] === 'object' && user[key] !== null && !Array.isArray(user[key])) {
      result[key] = mergeThemes(base[key] || {}, user[key])
    } else {
      result[key] = user[key]
    }
  }
  return result
}