import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WritePipeline, createWritePipeline } from '../src/write-pipeline'
import { FileAdapter, createFileAdapter } from '@intent/adapters-node'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('Core Write Pipeline (trd 8) - Lock Bypass Attempts', () => {
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

  describe('Lock Bypass Attempts', () => {
    it('rejects move container holding locked child', async () => {
      const scene = {
        id: 'scene_test', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_parent', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 500, height: 500 }, children: ['frame_child'], props: {} },
          { id: 'frame_child', type: 'frame', parentId: 'frame_parent', rect: { x: 10, y: 10, width: 100, height: 100 }, children: [], props: {} }
        ],
        locks: [{ objectId: 'frame_child', lockedBy: 'user', timestamp: Date.now() }]
      }
      await adapter.write('.intent/scene.json', new TextEncoder().encode(JSON.stringify(scene)))

      const patch = { id: 'patch_1', baseRevision: 1, ops: [{ type: 'move', objectId: 'frame_parent', newParentId: 'scene_root' }] }
      const result = await pipeline.validatePatch(patch)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('lock')
    })

    it('rejects add into locked container', async () => {
      const scene = {
        id: 'scene_test', version: 1, rootId: 'frame_root',
        objects: [{ id: 'frame_parent', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 500, height: 500 }, children: [], props: {} }],
        locks: [{ objectId: 'frame_parent', lockedBy: 'user', timestamp: Date.now() }]
      }
      await adapter.write('.intent/scene.json', new TextEncoder().encode(JSON.stringify(scene)))

      const patch = { id: 'patch_1', baseRevision: 1, ops: [{ type: 'create', objectId: 'frame_child', objectType: 'frame', parentId: 'frame_parent', rect: { x: 10, y: 10, width: 100, height: 100 }, props: {} }] }
      const result = await pipeline.validatePatch(patch)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('lock')
    })

    it('rejects patch through locked ancestor', async () => {
      const scene = {
        id: 'scene_test', version: 1, rootId: 'frame_root',
        objects: [
          { id: 'frame_root', type: 'frame', parentId: 'scene_root', rect: { x: 0, y: 0, width: 1920, height: 1080 }, children: ['frame_a'], props: {} },
          { id: 'frame_a', type: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 500, height: 500 }, children: ['frame_b'], props: {} },
          { id: 'frame_b', type: 'frame', parentId: 'frame_a', rect: { x: 10, y: 10, width: 100, height: 100 }, children: [], props: {} }
        ],
        locks: [{ objectId: 'frame_a', lockedBy: 'user', timestamp: Date.now() }]
      }
      await adapter.write('.intent/scene.json', new TextEncoder().encode(JSON.stringify(scene)))

      const patch = { id: 'patch_1', baseRevision: 1, ops: [{ type: 'update', objectId: 'frame_b', props: { width: 200 } }] }
      const result = await pipeline.validatePatch(patch)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('lock')
    })
  })
})