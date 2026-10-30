/**
 * Core Ports (trd 6.1)
 * Pure interfaces for external dependencies.
 */

export interface Clock {
  now(): number
}

export interface IdGenerator {
  generate(prefix: string): string
}

export interface Hasher {
  hash(obj: unknown): string
}

export interface FileAdapter {
  read(path: string): Promise<Uint8Array>
  write(path: string, data: Uint8Array): Promise<void>
  delete(path: string): Promise<void>
  list(path: string): Promise<string[]>
  lock(path: string): Promise<void>
  unlock(path: string): Promise<void>
}

export function Clock(): Clock {
  return { now: () => Date.now() }
}

export function IdGenerator(): IdGenerator {
  let counter = 0
  return {
    generate: (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`,
  }
}

export function Hasher(): Hasher {
  return {
    hash: (obj: unknown) => {
      const str = JSON.stringify(obj, Object.keys(obj).sort())
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i)
        hash |= 0
      }
      return Math.abs(hash).toString(36)
    },
  }
}

export function FileAdapter(): FileAdapter {
  // This is a pure port - actual implementation in adapters-node
  return {
    read: async () => new Uint8Array(0),
    write: async () => {},
    delete: async () => {},
    list: async () => [],
    lock: async () => {},
    unlock: async () => {},
  }
}