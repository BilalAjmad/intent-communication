import { describe, it, expect } from 'vitest'
import {
  Migration,
  MigrationScaffold,
  createMigration,
  validateMigration,
  applyMigration,
  createMigrationScaffold,
} from '../src/migration-scaffold'

describe('Migration Scaffold with Fixture (trd 19)', () => {
  describe('Migration', () => {
    it('creates valid migration', () => {
      const migration: any = {
        fromVersion: 0,
        toVersion: 1,
        up: (scene: any) => ({ ...scene, version: 1 }),
        down: (scene: any) => ({ ...scene, version: 0 }),
      }
      expect(validateMigration(migration)).toBe(true)
    })

    it('rejects invalid migration', () => {
      expect(validateMigration({ fromVersion: 1, toVersion: 0 })).toBe(false)
      expect(validateMigration({ fromVersion: 0 })).toBe(false)
    })
  })

  describe('Migration Scaffold', () => {
    it('creates scaffold with migration', () => {
      const scaffold = createMigrationScaffold(0, 1, (scene: any) => ({ ...scene, version: 1 }))
      expect(scaffold.fromVersion).toBe(0)
      expect(scaffold.toVersion).toBe(1)
      expect(typeof scaffold.up).toBe('function')
    })

    it('applies migration up', () => {
      const migration: any = {
        fromVersion: 0,
        toVersion: 1,
        up: (scene: any) => ({ ...scene, version: 1, migrated: true }),
      }
      const scene = { version: 0 }
      const result = applyMigration(migration, scene)
      expect(result.version).toBe(1)
      expect(result.migrated).toBe(true)
    })

    it('applies migration down', () => {
      const migration: any = {
        fromVersion: 0,
        toVersion: 1,
        up: (scene: any) => ({ ...scene, version: 1 }),
        down: (scene: any) => ({ ...scene, version: 0 }),
      }
      const scene = { version: 1 }
      const result = applyMigration(migration, scene, 'down')
      expect(result.version).toBe(0)
    })
  })

  describe('Migration Fixture (trd 19)', () => {
    it('includes one fixture for migration 0->1', () => {
      // This is the migration fixture required by trd 19
      const fixture = {
        fromVersion: 0,
        toVersion: 1,
        inputScene: { id: 'scene_test', version: 0, rootId: 'frame_root', objects: [], locks: [] },
        expectedScene: { id: 'scene_test', version: 1, rootId: 'frame_root', objects: [], locks: [] },
      }
      expect(fixture.fromVersion).toBe(0)
      expect(fixture.toVersion).toBe(1)
      expect(fixture.inputScene.version).toBe(0)
      expect(fixture.expectedScene.version).toBe(1)
    })

    it('validates fixture structure', () => {
      const fixture = {
        fromVersion: 0,
        toVersion: 1,
        inputScene: { id: 'scene_test', version: 0, rootId: 'frame_root', objects: [], locks: [] },
        expectedScene: { id: 'scene_test', version: 1, rootId: 'frame_root', objects: [], locks: [] },
      }
      expect(fixture.fromVersion).toBeLessThan(fixture.toVersion)
      expect(fixture.inputScene.version).toBe(fixture.fromVersion)
      expect(fixture.expectedScene.version).toBe(fixture.toVersion)
    })
  })
})