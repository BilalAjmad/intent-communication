/**
 * FileAdapter - Node.js filesystem implementation (trd 9.1, 9.2)
 * Path safety, atomic writes, locking, watching.
 */

import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

export interface FileAdapter {
  read(path: string): Promise<Uint8Array>
  write(path: string, data: Uint8Array): Promise<void>
  delete(path: string): Promise<void>
  list(path: string): Promise<string[]>
  lock(path: string): Promise<LockHandle>
  unlock(path: string): Promise<void>
  watch(path: string, callback: (event: string, filename: string) => void): Promise<WatchHandle>
}

export interface LockHandle {
  release(): Promise<void>
}

export interface WatchHandle {
  close(): Promise<void>
}

const INTENT_DIR = '.intent'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 50

function normalizePath(relPath: string, rootDir: string): string {
  // Reject absolute paths
  if (path.isAbsolute(relPath)) {
    throw new Error('Absolute paths not allowed')
  }
  // Reject directory traversal
  if (relPath.includes('..')) {
    throw new Error('Directory traversal not allowed')
  }
  // Must be under .intent/
  if (!relPath.startsWith(INTENT_DIR + path.sep) && relPath !== INTENT_DIR) {
    throw new Error('Path must be under .intent/')
  }
  return path.resolve(rootDir, relPath)
}

function ensureIntentDir(rootDir: string): void {
  const intentPath = path.join(rootDir, INTENT_DIR)
  if (!fsSync.existsSync(intentPath)) {
    fsSync.mkdirSync(intentPath, { recursive: true })
  }
}

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
  let lastError: Error
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      // Retry on Windows EPERM or similar transient errors
      if (i < maxRetries && isRetryableError(error)) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (i + 1)))
        continue
      }
      throw error
    }
  }
  throw lastError!
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Windows EPERM, EACCES, EBUSY
    return ['EPERM', 'EACCES', 'EBUSY', 'ENOTEMPTY'].some(code => error.message.includes(code))
  }
  return false
}

export function createFileAdapter(rootDir: string): FileAdapter {
  ensureIntentDir(rootDir)

  // Clean up stale temp files on startup
  cleanupStaleTempFiles(rootDir)

  return {
    async read(relPath: string) {
      const absPath = normalizePath(relPath, rootDir)
      return fs.readFile(absPath)
    },

    async write(relPath: string, data: Uint8Array) {
      const absPath = normalizePath(relPath, rootDir)
      await fs.mkdir(path.dirname(absPath), { recursive: true })

      // Atomic write: write to temp, then rename
      const tempPath = absPath + '.tmp_write_' + Date.now() + '_' + Math.random().toString(36).slice(2)
      await fs.writeFile(tempPath, data)
      await fs.rename(tempPath, absPath)
    },

    async delete(relPath: string) {
      const absPath = normalizePath(relPath, rootDir)
      await fs.unlink(absPath)
    },

    async list(relPath: string) {
      const absPath = normalizePath(relPath, rootDir)
      return fs.readdir(absPath)
    },

    async lock(relPath: string) {
      const absPath = normalizePath(relPath, rootDir)
      const lockPath = absPath + '.lock'

      // Try to create lock file exclusively
      try {
        await fs.open(lockPath, 'wx')
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          throw new Error('Lock already held')
        }
        throw error
      }

      return {
        async release() {
          try {
            await fs.unlink(lockPath)
          } catch {
            // Ignore if already removed
          }
        }
      }
    },

    async unlock(relPath: string) {
      const absPath = normalizePath(relPath, rootDir)
      const lockPath = absPath + '.lock'
      await fs.unlink(lockPath).catch(() => {})
    },

    async watch(relPath: string, callback: (event: string, filename: string) => void) {
      const absPath = normalizePath(relPath, rootDir)
      const watcher = fsSync.watch(absPath, { recursive: false }, callback)
      return {
        async close() {
          watcher.close()
        }
      }
    },
  }
}

function cleanupStaleTempFiles(rootDir: string) {
  const intentDir = path.join(rootDir, INTENT_DIR)
  if (!fsSync.existsSync(path.dirname(rootDir))) return

  try {
    const entries = fsSync.readdirSync(intentDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith('.tmp_write_')) {
        const filePath = path.join(intentDir, entry.name)
        try {
          fsSync.unlinkSync(filePath)
        } catch {
          // Ignore
        }
      }
    } catch {
      // Ignore if .intent doesn't exist yet
    }
  }
}

// Synchronous version for startup cleanup
const fsSync = require('fs')