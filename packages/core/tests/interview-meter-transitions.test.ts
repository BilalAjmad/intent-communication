import { describe, it, expect } from 'vitest'
import { applyDelegation, applyStated, applyReopen, applyFatigue, applyCaps } from '../src/interview/meter'

describe('Interview Meter - State Transitions', () => {
  describe('applyDelegation', () => {
    it('sets slot status to delegated', () => {
      const slots = { 'goal.purpose': { status: 'unknown' } }
      const result = applyDelegation(slots, ['goal.purpose'])
      expect(result['goal.purpose'].status).toBe('delegated')
    })

    it('only affects specified slots', () => {
      const slots = { 
        'goal.purpose': { status: 'unknown' },
        'goal.platform': { status: 'unknown' }
      }
      const result = applyDelegation(slots, ['goal.purpose'])
      expect(result['goal.purpose'].status).toBe('delegated')
      expect(result['goal.platform'].status).toBe('unknown')
    })
  })

  describe('applyStated', () => {
    it('sets slot status to stated', () => {
      const slots = { 'goal.purpose': { status: 'unknown' } }
      const result = applyStated(slots, ['goal.purpose'])
      expect(result['goal.purpose'].status).toBe('stated')
    })
  })

  describe('applyReopen', () => {
    it('reopens slot and lowers meter', () => {
      const slots = { 'goal.purpose': { status: 'stated' } }
      const result = applyReopen(slots, ['goal.purpose'])
      expect(result['goal.purpose'].status).toBe('unknown')
    })
  })

  describe('applyFatigue', () => {
    it('applies fatigue hint after SC-4 threshold', () => {
      const slots = { 'goal.purpose': { status: 'unknown' } }
      const result = applyFatigue(slots, 5)
      expect(result['goal.purpose'].fatigueHint).toBeDefined()
    })

    it('does not apply before threshold', () => {
      const slots = { 'goal.purpose': { status: 'unknown' } }
      const result = applyFatigue(slots, 2)
      expect(result['goal.purpose'].fatigueHint).toBeUndefined()
    })
  })

  describe('applyCaps', () => {
    it('caps at 89 when required topic at none', () => {
      const topicMeters = {
        goal: { percent: 0, weight: 20 },
        users: { percent: 100, weight: 10 },
        screens: { percent: 100, weight: 20 },
        flow: { percent: 100, weight: 15 },
        style: { percent: 100, weight: 15 },
        content: { percent: 100, weight: 20 },
      }
      const result = applyCaps(topicMeters)
      expect(result).toBeLessThanOrEqual(89)
    })

    it('does not cap when all required topics have values', () => {
      const topicMeters = {
        goal: { percent: 50, weight: 20 },
        users: { percent: 100, weight: 10 },
        screens: { percent: 100, weight: 20 },
        flow: { percent: 100, weight: 15 },
        style: { percent: 100, weight: 15 },
        content: { percent: 100, weight: 20 },
      }
      const result = applyCaps(topicMeters)
      expect(result).toBeGreaterThan(89)
    })
  })
}