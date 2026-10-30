import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileAdapter, createFileAdapter } from '../src/file-adapter'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('FileAdapter - Read/Write/Delete', () => {
  let testDir: string
  let adapter: ReturnType<typeof createFileAdapter>

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-test-'))
    adapter = createFileAdapter(testDir)
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('writes and reads file', async () => {
    const data = new TextEncoder().encode('hello world')
    await adapter.write('.intent/test.txt', data)
    const read = await adapter.read('.intent/test.txt')
    expect(new TextDecoder().decode(read)).toBe('hello world')
  })

  it('creates parent directories', async () => {
    await adapter.write('.intent/nested/deep/file.txt', new TextEncoder().encode('deep'))
    const read = await adapter.read('.intent/nested/deep/file.txt')
    expect(new TextDecoder().decode(read)).toBe('deep')
  })

  it('overwrites existing file', async () => {
    await adapter.write('.intent/overwrite.txt', new TextEncoder().encode('v1'))
    await adapter.write('.intent/overwrite.txt', new TextEncoder().encode('v2'))
    const read = await adapter.read('.intent/overwrite.txt')
    expect(new TextDecoder().decode(read)).toBe('v2')
  })

  it('rejects write outside .intent/', async () => {
    await expect(adapter.write('/etc/passwd', new TextEncoder().encode('x'))).rejects.toThrow()
  })

  it('deletes file', async () => {
    await adapter.write('.intent/delete.txt', new TextEncoder().encode('x'))
    await adapter.delete('.intent/delete.txt')
    await expect(adapter.read('.intent/delete.txt')).rejects.toThrow()
  })

  it('rejects delete outside .intent/', async () => {
    await expect(adapter.delete('/etc/passwd')).rejects.toThrow()
  })

  it('lists files in directory', async () => {
    await adapter.write('.intent/a.txt', new TextEncoder().encode('a'))
    await adapter.write('.intent/b.txt', new TextEncoder().encode('b'))
    const files = await adapter.list('.intent')
    expect(files).toContain('a.txt')
    expect(files).toContain('b.txt')
  })

  it('returns empty array for empty directory', async () => {
    const files = await adapter.list('.intent')
    expect(files).toEqual([])
  })
})