/**
 * Config (trd 15)
 * Configuration schema and validation.
 */

import { z } from 'zod'

export interface SceneConfig {
  maxObjects: number
  maxDepth: number
}

export interface LockConfig {
  timeoutMs: number
  maxRetries: number
}

export interface WriteConfig {
  atomic: boolean
  coalesceMs: number
}

export interface InterviewConfig {
  maxQuestions: number
  defaultMode: 'full' | 'quick' | 'refine'
}

export interface ServerConfig {
  port: number
  host: string
}

export interface MCPConfig {
  maxBytes: number
}

export interface LinterConfig {
  strict: boolean
}

export interface Config {
  version: number
  scene: SceneConfig
  lock: LockConfig
  write: WriteConfig
  interview: InterviewConfig
  server: ServerConfig
  mcp: MCPConfig
  linter: LinterConfig
}

export const ConfigSchema = z.object({
  version: z.literal(1),
  scene: z.object({
    maxObjects: z.number().int().positive().max(10000),
    maxDepth: z.number().int().positive().max(100),
  }),
  lock: z.object({
    timeoutMs: z.number().int().positive().max(60000),
    maxRetries: z.number().int().nonnegative().max(10),
  }),
  write: z.object({
    atomic: z.boolean(),
    coalesceMs: z.number().int().nonnegative().max(1000),
  }),
  interview: z.object({
    maxQuestions: z.number().int().positive().max(20),
    defaultMode: z.enum(['full', 'quick', 'refine']),
  }),
  server: z.object({
    port: z.number().int().positive().max(65535),
    host: z.string().ip(),
  }),
  mcp: z.object({
    maxBytes: z.number().int().positive().max(1048576),
  }),
  linter: z.object({
    strict: z.boolean(),
  }),
})

export const defaultConfig: Config = {
  version: 1,
  scene: { maxObjects: 500, maxDepth: 10 },
  lock: { timeoutMs: 5000, maxRetries: 3 },
  write: { atomic: true, coalesceMs: 10 },
  interview: { maxQuestions: 5, defaultMode: 'full' },
  server: { port: 3000, host: '127.0.0.1' },
  mcp: { maxBytes: 32768 },
  linter: { strict: true },
}

export function validateConfig(config: unknown): config is Config {
  return ConfigSchema.safeParse(config).success
}

export function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    ...base,
    ...override,
    scene: { ...base.scene, ...override.scene },
    lock: { ...base.lock, ...override.lock },
    write: { ...base.write, ...override.write },
    interview: { ...base.interview, ...override.interview },
    server: { ...base.server, ...override.server },
    mcp: { ...base.mcp, ...override.mcp },
    linter: { ...base.linter, ...override.linter },
  }
}