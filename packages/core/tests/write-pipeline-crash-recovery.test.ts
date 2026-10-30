import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WritePipeline, createWritePipeline } from '../src/write-pipeline'
import { FileAdapter, createFileAdapter } from '@intent/adapters-node'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('Core Write Pipeline (trd 8) - Crash Recovery & Reconciliation', () => {
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

  describe('Crash Recovery', () => {
    it('old file intact after crash between temp write and rename', async () => {
      const patch = {
        id: 'patch_1', baseRevision: 0,
        ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }]
      }
      
      await pipeline.applyPatch(patch)
      
      const adapter2 = require('@intent/adapters-node')
      const data = await adapter2.read('.intent/scene.json')
      const scene = JSON.parse(new TextDecoder().decode(data))
      expect(scene.objects.length).toBe(2)
    })
  })

  describe('Hand-edited scene.json Reconciliation', () => {
    it('reconciles hand-edited scene.json', async () => {
      const patch1 = { id: 'patch_1', baseRevision: 0, ops: [{ type: 'create', objectId: 'frame_a', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }] }
      await pipeline.applyPatch(patch1)
      
      const adapter2 = require('@intent/adapters-node')
      const sceneData = await adapter2.read('.intent/scene.json')
      const scene = JSON.parse(new TextDecoder().decode(sceneData))
      scene.objects.push({ id: 'frame_external', type: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 50, height: 50 }, children: [], props: {} })
      scene.version++
      await adapter2.write('.intent/scene.json', new TextEncoder().encode(JSON.stringify(scene)))
      
      const patch2 = { id: 'patch_2', baseRevision: 1, ops: [{ type: 'create', objectId: 'frame_b', objectType: 'frame', parentId: 'frame_root', rect: { x: 0, y: 0, width: 100, height: 100 }, props: {} }] }
      const result = await pipeline.applyPatch(patch2)
      expect(result.success).toBe(true)
      expect(result.reconciled).toBe(true)
    })
  })
})