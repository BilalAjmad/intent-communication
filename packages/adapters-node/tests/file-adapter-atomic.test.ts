import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileAdapter, createFileAdapter } from '../src/file-adapter'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('FileAdapter - writeAtomic with Windows retry', () => {
  let testDir: string
  let adapter: ReturnType<typeof createFileAdapter>

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-test-'))
    adapter = createFileAdapter(testDir)
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('writes atomically (temp + rename)', async () => {
    await adapter.write('.intent/atomic.txt', new TextEncoder().encode('v1'))
    await adapter.write('.intent/atomic.txt', new TextEncoder().encode('v2'))
    const read = await adapter.read('.intent/atomic.txt')
    expect(new TextDecoder().decode(read)).toBe('v2')
  })

  it('retries on Windows EPERM (retry logic exists)', async () => {
    await adapter.write('.intent/retry.txt', new TextEncoder().encode('x'))
    const read = await adapter.read('.intent/retry.txt')
    expect(new TextDecoder().decode(read)).toBe('x')
  })
})