import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileAdapter, createFileAdapter } from '../src/file-adapter'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('FileAdapter - Path Safety (trd 9.1)', () => {
  let testDir: string
  let adapter: ReturnType<typeof createFileAdapter>

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-test-'))
    adapter = createFileAdapter(testDir)
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('allows reads within .intent/', async () => {
    await fs.writeFile(path.join(testDir, '.intent', 'scene.json'), '{}')
    const data = await adapter.read('.intent/scene.json')
    expect(data).toBeInstanceOf(Uint8Array)
  })

  it('rejects paths outside .intent/', async () => {
    await expect(adapter.read('/etc/passwd')).rejects.toThrow()
    await expect(adapter.read('../secret.txt')).rejects.toThrow()
  })

  it('rejects absolute paths', async () => {
    await expect(adapter.read('/absolute/path')).rejects.toThrow()
  })

  it('rejects directory traversal', async () => {
    await expect(adapter.read('.intent/../secret')).rejects.toThrow()
  })

  it('rejects symlinks pointing outside .intent/', async () => {
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-target-'))
    await fs.writeFile(path.join(targetDir, 'secret.txt'), 'secret')
    await fs.symlink(targetDir, path.join(testDir, '.intent', 'link'), 'dir')
    await expect(adapter.read('.intent/link/secret.txt')).rejects.toThrow()
    await fs.rm(targetDir, { recursive: true, force: true })
  })
})