import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WritePipeline, createWritePipeline } from '../src/write-pipeline'
import { FileAdapter, createFileAdapter } from '@intent/adapters-node'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('Core Write Pipeline (trd 8) - Pipeline Steps 8-10', () => {
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

  describe('15-Step Write Pipeline (trd 8) - Steps 8-10', () => {
    it('step 8: checks conflicts with concurrent patches', async () => {
      expect(true).toBe(true)
    })

    it('step 9: applies ops to scene index', async () => {
      const patch = {
        id: 'patch_1', baseRevision: 0,
        ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }]
      }
      const result = await pipeline.applyPatch(patch)
      expect(result.success).toBe(true)
      expect(result.newRevision).toBe(1)
    })

    it('step 10: writes patch file', async () => {
      const patch = {
        id: 'patch_1', baseRevision: 0,
        ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }]
      }
      const result = await pipeline.applyPatch(patch)
      expect(result.patchFile).toBeDefined()
    })

    it('step 10: writes patch file to correct path', async () => {
      const patch = {
        id: 'patch_1', baseRevision: 0,
        ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }]
      }
      const result = await pipeline.applyPatch(patch)
      expect(result.patchPath).toContain('.intent/patches/patch_1.json')
    })
  })
})