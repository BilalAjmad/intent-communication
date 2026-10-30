/**
 * Watch wrapper (trd 9.4)
 * Wrapper over chokidar (chosen in S-0-01) for file watching.
 */

import * as chokidar from 'chokidar'

export interface WatchHandle {
  close(): Promise<void>
}

export interface WatchOptions {
  persistent?: boolean
  ignoreInitial?: boolean
  awaitWriteFinish?: {
    stabilityThreshold: number
    pollInterval: number
  }
  ignored?: string | RegExp | (string | RegExp)[]
  depth?: number
}

export function createWatch(
  path: string,
  callback: (event: string, filename: string) => void,
  options: WatchOptions = {}
): WatchHandle {
  const watcher = chokidar.watch(path, {
    persistent: options.persistent ?? true,
    ignoreInitial: options.ignoreInitial ?? true,
    awaitWriteFinish: options.awaitWriteFinish ?? {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
    ignored: options.ignored,
    depth: options.depth,
  })

  watcher.on('all', callback)

  return {
    async close() {
      await watcher.close()
    }
  }
}

export function createWatchForIntent(rootDir: string, callback: (event: string, filename: string) => void): WatchHandle {
  const intentDir = path.join(rootDir, '.intent')
  return createWatch(intentDir, callback, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
    ignored: ['**/.tmp_write_*', '**/*.lock'],
  })
}

import * as path from 'path'
import * as chokidar from 'chokidar'