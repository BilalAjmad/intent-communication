/**
 * Migration Scaffold with Fixture (trd 19)
 */

import { Scene } from './scene-types'

export interface Migration {
  fromVersion: number
  toVersion: number
  up: (scene: Scene) => Scene
  down?: (scene: Scene) => Scene
}

export interface MigrationScaffold {
  fromVersion: number
  toVersion: number
  up: (scene: Scene) => Scene
  down?: (scene: Scene) => Scene
}

export function validateMigration(migration: Migration): boolean {
  if (typeof migration.fromVersion !== 'number' || typeof migration.toVersion !== 'number') return false
  if (migration.fromVersion >= migration.toVersion) return false
  if (typeof migration.up !== 'function') return false
  if (migration.down && typeof migration.down !== 'function') return false
  return true
}

export function createMigrationScaffold(
  fromVersion: number,
  toVersion: number,
  upFn: (scene: any) => any,
  downFn?: (scene: any) => any
): MigrationScaffold {
  return {
    fromVersion,
    toVersion,
    up: upFn,
    down: downFn,
  }
}

export function applyMigration(migration: Migration, scene: any, direction: 'up' | 'down' = 'up'): any {
  if (direction === 'up') {
    return migration.up(scene)
  }
  if (direction === 'down' && migration.down) {
    return migration.down(scene)
  }
  throw new Error('Down migration not available')
}

/**
 * Migration fixture for trd 19
 * Migration 0 -> 1: adds version field to scene
 */
export const MIGRATION_0_TO_1 = {
  fromVersion: 0,
  toVersion: 1,
  up: (scene: any) => ({
    ...scene,
    version: 1,
  }),
  down: (scene: any) => ({
    ...scene,
    version: 0,
  }),
}

/**
 * Migration fixture for testing
 * This is the fixture required by trd 19
 */
export const MIGRATION_FIXTURE_0_1 = {
  fromVersion: 0,
  toVersion: 1,
  inputScene: {
    id: 'scene_test',
    version: 0,
    rootId: 'frame_root',
    objects: [],
    locks: [],
  },
  expectedScene: {
    id: 'scene_test',
    version: 1,
    rootId: 'frame_root',
    objects: [],
    locks: [],
  },
}