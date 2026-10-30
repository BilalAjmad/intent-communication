import { describe, it, expect } from 'vitest'
import {
  Config,
  ConfigSchema,
  defaultConfig,
  validateConfig,
  mergeConfig,
} from '../src/config'

describe('Config (trd 15)', () => {
  describe('ConfigSchema', () => {
    it('accepts valid config', () => {
      const config: Config = {
        version: 1,
        scene: { maxObjects: 500, maxDepth: 10 },
        lock: { timeoutMs: 5000, maxRetries: 3 },
        write: { atomic: true, coalesceMs: 10 },
        interview: { maxQuestions: 5, defaultMode: 'full' },
        server: { port: 3000, host: '127.0.0.1' },
        mcp: { maxBytes: 32768 },
        linter: { strict: true },
      }
      expect(validateConfig(config)).toBe(true)
    })

    it('rejects invalid config', () => {
      expect(validateConfig({ version: 0 })).toBe(false)
      expect(validateConfig({ scene: { maxObjects: -1 } })).toBe(false)
      expect(validateConfig({ lock: { timeoutMs: 0 } })).toBe(false)
      expect(validateConfig({ write: { atomic: 'yes' } })).toBe(false)
    })
  })

  describe('defaultConfig', () => {
    it('provides sensible defaults', () => {
      const config = defaultConfig()
      expect(config.version).toBe(1)
      expect(config.scene.maxObjects).toBe(500)
      expect(config.lock.timeoutMs).toBe(5000)
      expect(config.write.atomic).toBe(true)
      expect(config.interview.maxQuestions).toBe(5)
      expect(config.server.port).toBe(3000)
      expect(config.mcp.maxBytes).toBe(32768)
    })
  })

  describe('mergeConfig', () => {
    it('merges user config with defaults', () => {
      const userConfig = { scene: { maxObjects: 1000 } }
      const merged = mergeConfig(defaultConfig(), userConfig)
      expect(merged.scene.maxObjects).toBe(1000)
      expect(merged.lock.timeoutMs).toBe(5000) // unchanged
    })

    it('deep merges nested objects', () => {
      const userConfig = { scene: { maxDepth: 20 } }
      const merged = mergeConfig(defaultConfig(), userConfig)
      expect(merged.scene.maxDepth).toBe(20)
      expect(merged.scene.maxObjects).toBe(500) // preserved
    })

    it('does not mutate original configs', () => {
      const defaults = defaultConfig()
      const userConfig = { scene: { maxObjects: 1000 } }
      mergeConfig(defaults, userConfig)
      expect(defaults.scene.maxObjects).toBe(500)
    })
  })

  describe('ConfigSchema (Zod)', () => {
    it('parses valid config', () => {
      const config = { version: 1, scene: { maxObjects: 500, maxDepth: 10 } }
      const result = ConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    })

    it('rejects invalid config with detailed errors', () => {
      const result = ConfigSchema.safeParse({ version: '1' })
      expect(result.success).toBe(false)
      expect(result.error.errors.length).toBeGreaterThan(0)
    })

    it('enforces positive integers', () => {
      expect(ConfigSchema.safeParse({ scene: { maxObjects: 0 } }).success).toBe(false)
      expect(ConfigSchema.safeParse({ scene: { maxObjects: -1 } }).success).toBe(false)
    })
  })
})