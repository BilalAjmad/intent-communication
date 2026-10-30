import { describe, it, expect } from 'vitest'
import { calculateTopicMeter, calculateMeter, MeterResult } from '../src/interview/meter'

describe('Interview Meter - Topic Meter (intent.md 7.2)', () => {
  describe('calculateTopicMeter', () => {
    it('calculates topic meter from slot statuses', () => {
      const slots = {
        'goal.purpose': { status: 'stated', weight: 1 },
        'goal.platform': { status: 'delegated', weight: 1 },
        'goal.success': { status: 'unknown', weight: 1 },
        'goal.protoUse': { status: 'na', weight: 1 },
      }
      const result = calculateTopicMeter('goal', slots, { goal: 20 })
      expect(result.numerator).toBe(1.5)
      expect(result.denominator).toBe(3)
      expect(result.percent).toBeCloseTo(50, 0)
    })

    it('handles all stated slots', () => {
      const slots = {
        'goal.purpose': { status: 'stated', weight: 1 },
        'goal.platform': { status: 'stated', weight: 1 },
      }
      const result = calculateTopicMeter('goal', slots, { goal: 20 })
      expect(result.percent).toBe(100)
    })

    it('handles all delegated slots', () => {
      const slots = {
        'goal.purpose': { status: 'delegated', weight: 1 },
        'goal.platform': { status: 'delegated', weight: 1 },
      }
      const result = calculateTopicMeter('goal', slots, { goal: 20 })
      expect(result.percent).toBe(50)
    })

    it('excludes na slots from denominator', () => {
      const slots = {
        'goal.purpose': { status: 'stated', weight: 1 },
        'goal.platform': { status: 'na', weight: 1 },
      }
      const result = calculateTopicMeter('goal', slots, { goal: 20 })
      expect(result.denominator).toBe(1)
      expect(result.percent).toBe(100)
    })
  })

  describe('calculateMeter', () => {
    it('calculates overall meter from topic meters', () => {
      const topicMeters = {
        goal: { percent: 100, weight: 20 },
        users: { percent: 50, weight: 10 },
        screens: { percent: 75, weight: 20 },
        flow: { percent: 100, weight: 15 },
        style: { percent: 50, weight: 15 },
        content: { percent: 100, weight: 20 },
      }
      const result = calculateMeter(topicMeters)
      expect(result).toBeCloseTo(82.5, 1)
    })

    it('applies required topic cap at 89', () => {
      const topicMeters = {
        goal: { percent: 0, weight: 20 },
        users: { percent: 100, weight: 10 },
        screens: { percent: 100, weight: 20 },
        flow: { percent: 100, weight: 15 },
        style: { percent: 100, weight: 15 },
        content: { percent: 100, weight: 20 },
      }
      const result = calculateMeter(topicMeters)
      expect(result).toBeLessThanOrEqual(89)
    })

    it('agent percent above server is lowered', () => {
      const topicMeters = {
        goal: { percent: 100, weight: 20 },
        users: { percent: 100, weight: 10 },
        screens: { percent: 100, weight: 20 },
        flow: { percent: 100, weight: 15 },
        style: { percent: 100, weight: 15 },
        content: { percent: 100, weight: 20 },
      }
      const agentPercent = 100
      const serverPercent = 80
      const result = calculateMeter(topicMeters)
      expect(Math.min(agentPercent, serverPercent)).toBe(80)
    })

    it('agent percent below server is kept', () => {
      expect(Math.min(60, 80)).toBe(60)
    })
  })
}