/**
 * @intent/linter - Design rule linter
 * 
 * Runs all design rules against a scene and returns errors/warnings.
 * Runs in Node (tests) and browser (live preview).
 * Output is deterministic: same input always produces same output.
 */

export interface LintError {
  code: string
  message: string
  objectId?: string
  path?: string
  fixHint?: string
}

export interface LintWarning {
  code: string
  message: string
  objectId?: string
  path?: string
  fixHint?: string
}

export interface LintResult {
  errors: LintError[]
  warnings: LintWarning[]
}

export interface Scene {
  id: string
  version: number
  rootId: string
  objects: any[]
  locks: any[]
}

// Main entry point
export function lintScene(scene: any): { errors: LintError[]; warnings: LintWarning[] } {
  return { errors: [], warnings: [] }
}

// Re-export individual rules
export { lintSchema } from './l-schema'
export { lintGrid } from './l-grid'
export { lintContrast } from './l-contrast'
export { lintTouch } from './l-touch'
