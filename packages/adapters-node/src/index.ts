/**
 * @intent/adapters-node - Node.js filesystem adapters
 * 
 * Provides FileAdapter with path safety, atomic writes, locking, and watching.
 */

export { FileAdapter, createFileAdapter, LockHandle, WatchHandle } from './file-adapter'
export { createWatch, createWatchForIntent, WatchHandle, WatchOptions } from './watch'
