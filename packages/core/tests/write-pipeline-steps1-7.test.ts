import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WritePipeline, createWritePipeline } from '../src/write-pipeline'
import { FileAdapter, createFileAdapter } from '@intent/adapters-node'
import { Scene, Patch, Op } from '@intent/schema'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('Core Write Pipeline (trd 8) - Pipeline Steps 1-7', () => {
  let testDir: string
  let adapter: ReturnType<typeof createFileAdapter>
  let pipeline: ReturnType<typeof createWritePipeline>

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-test-'))
    adapter = createFileAdapter(testDir)
    pipeline = createWritePipeline(adapter)
    
    await fs.writeFile(path.join(testDir, '.intent', 'scene.json'), new TextEncoder().encode(JSON.stringify({
      id: 'scene_test',
      version: 0,
      rootId: 'frame_root',
      objects: [{
        id: 'frame_root',
        type: 'frame',
        parentId: 'scene_root',
        rect: { x: 0, y: 0, width: 1920, height: 1080 },
        children: [],
        props: {}
      }],
      locks: []
    }))
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('15-Step Write Pipeline (trd 8) - Steps 1-7', () => {
    it('step 1: validates patch structure', async () => {
      const patch = { id: 'patch_1', baseRevision: 0, ops: [] }
      const result = await pipeline.validatePatch(patch)
      expect(result.valid).toBe(true)
    })

    it('step 2: checks base revision matches', async () => {
      const patch = { id: 'patch_1', baseRevision: 5, ops: [] }
      const result = await pipeline.validatePatch(patch)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('revision')
    })

    it('step 3: checks path whitelist', async () => {
      const patch = {
        id: 'patch_1', baseRevision: 0,
        ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }]
      }
      const result = await pipeline.validatePatch(patch)
      expect(result.valid).toBe(true)
    })

    it('step 4: checks scope escape', async () => {
      const scene = {
        id: 'scene_test', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_root', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 1920, height: 1080 }, children: ['frame_a'], props: {} },
          { id: 'frame_a', type: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 500, height: 500 }, children: ['frame_b'], props: {} },
          { id: 'frame_b', type: 'frame', parentId: 'frame_a', rect: { x: 10, y: 10, width: 100, height: 100 }, children: [], props: {} },
          { id: 'frame_c', type: 'frame', parentId: 'scene_root', rect: { x: 1000, y: 1000, width: 100, height: 100 }, children: [], props: {} }
        ],
        locks: []
      }
      await adapter.write('.intent/scene.json', new TextEncoder().encode(JSON.stringify(scene)))

      const patch = {
        id: 'patch_1', baseRevision: 1,
        ops: [{ type: 'move', objectId: 'frame_b', newParentId: 'frame_root' }]
      }
      const result = await pipeline.validatePatch(patch)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('scope')
    })

    it('step 5: checks lock conflicts', async () => {
      const scene = {
        id: 'scene_test', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_parent', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 500, height: 500 }, children: ['frame_child'], props: {} },
          { id: 'frame_child', type: 'frame', parentId: 'frame_parent', rect: { x: 10, y: 10, width: 100, height: 100 }, children: [], props: {} }
        ],
        locks: [{ objectId: 'frame_child', lockedBy: 'user', timestamp: Date.now() }]
      }
      await adapter.write('.intent/scene.json', new TextEncoder().encode(JSON.stringify(scene)))

      const patch = {
        id: 'patch_1', baseRevision: 1,
        ops: [{ type: 'update', objectId: 'frame_child', props: { width: 200 } }]
      }
      const result = await pipeline.validatePatch(patch)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('lock')
    })

    it('step 6: validates against schema', async () => {
      const patch = {
        id: 'patch_1', baseRevision: 0,
        ops: [{ type: 'create', objectId: 'frame_a', objectType: 'invalid_type', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }]
      }
      const result = await pipeline.validatePatch(patch)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('schema')
    })

    it('step 7: runs linter', async () => {
      const patch = {
        id: 'patch_1', baseRevision: 0,
        ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 1, y: 1, width: 101, height: 101 }, props: {} }]
      }
      const result = await pipeline.validatePatch(patch)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('L-GRID')
    })
  })
})