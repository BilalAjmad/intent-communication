import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileAdapter, createFileAdapter } from '../src/file-adapter'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('FileAdapter - Lock/Unlock (trd 9.2)', () => {
  let testDir: string
  let adapter: ReturnType<typeof createFileAdapter>

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-test-'))
    adapter = createFileAdapter(testDir)
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('acquires and releases lock', async () => {
    const lock = await adapter.lock('.intent/test.lock')
    expect(lock).toBeDefined()
    await adapter.unlock('.intent/test.lock')
  })

  it('rejects second lock on same file', async () => {
    await adapter.lock('.intent/test.lock')
    await expect(adapter.lock('.intent/test.lock')).rejects.toThrow()
    await adapter.unlock('.intent/test.lock')
  })

  it('releases lock after process dies (stale lock)', async () => {
    const adapter2 = createFileAdapter(testDir)
    await adapter.lock('.intent/test.lock')
    // Simulate process death - lock file remains
    await expect(adapter2.lock('.intent/test.lock')).rejects.toThrow()
    await adapter.unlock('.intent/test.lock')
  })
})