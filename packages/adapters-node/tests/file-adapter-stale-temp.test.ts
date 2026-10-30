import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileAdapter, createFileAdapter } from '../src/file-adapter'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('FileAdapter - Stale temp cleanup', () => {
  let testDir: string
  let adapter: ReturnType<typeof createFileAdapter>

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-test-'))
    adapter = createFileAdapter(testDir)
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('cleans up stale temp files on startup', async () => {
    // Create a temp file manually
    const tempFile = path.join(testDir, '.intent', '.tmp_write_123')
    await fs.mkdir(path.dirname(tempFile), { recursive: true })
    await fs.writeFile(tempFile, 'stale')

    // Create new adapter - should clean up
    const adapter2 = createFileAdapter(testDir)
    await new Promise(r => setTimeout(r, 100))

    const exists = await fs.access(tempFile).then(() => true).catch(() => false)
    expect(exists).toBe(false)
  })
})