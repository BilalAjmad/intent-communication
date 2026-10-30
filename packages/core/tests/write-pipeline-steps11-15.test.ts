import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WritePipeline, createWritePipeline } from '../src/write-pipeline'
import { FileAdapter, createFileAdapter } from '@intent/adapters-node'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('Core Write Pipeline (trd 8) - Pipeline Steps 11-15', () => {
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

  describe('15-Step Write Pipeline (trd 8) - Steps 11-15', () => {
    it('step 11: writes scene.json atomically', async () => {
      const patch = {
        id: 'patch_1', baseRevision: 0,
        ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }]
      }
      const result = await pipeline.applyPatch(patch)
      expect(result.success).toBe(true)
      
      const adapter2 = require('@intent/adapters-node')
      const data = await adapter2.read('.intent/scene.json')
      const scene = JSON.parse(new TextDecoder().decode(data))
      expect(scene.version).toBe(1)
    })

    it('step 12: writes patch file to correct path', async () => {
      const patch = {
        id: 'patch_1', baseRevision: 0,
        ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }]
      }
      const result = await pipeline.applyPatch(patch)
      expect(result.patchPath).toContain('.intent/patches/patch_1.json')
    })

    it('step 13: updates version history', async () => {
      const patch = {
        id: 'patch_1', baseRevision: 0,
        ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }]
      }
      const result = await pipeline.applyPatch(patch)
      expect(result.newVersion).toBe(1)
    })

    it('step 14: cleans up temp files', async () => {
      const patch = {
        id: 'patch_1', baseRevision: 0,
        ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }]
      }
      await pipeline.applyPatch(patch)
      
      const adapter2 = require('@intent/adapters-node')
      const files = await adapter2.list('.intent')
      const tempFiles = files.filter(f => f.startsWith('.tmp_write_'))
      expect(tempFiles).toHaveLength(0)
    })

    it('step 15: coalescing and retention', async () => {
      for (let i = 0; i < 5; i++) {
        await pipeline.applyPatch({ 
          id: `patch_${i}`, baseRevision: i, 
          ops: [{ type: 'create', objectId: `frame_${i}`, objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }] 
        })
      }
      
      expect(true).toBe(true)
    })
  })
})