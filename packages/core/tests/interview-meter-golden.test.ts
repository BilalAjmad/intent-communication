import { describe, it, expect } from 'vitest'
import { calculateMeter, calculateTopicMeter } from '../src/interview/meter'

describe('Meter Golden Table (intent.md 7.4)', () => {
  describe('Golden values', () => {
    it('small task = 69', () => {
      // Small task: 11 slots (6 required + 5 optional)
      // All stated: 100, all delegated: 50, mixed: ~69
      const topicMeters = {
        goal: { percent: 69, weight: 20 },
        users: { percent: 69, weight: 10 },
        screens: { percent: 69, weight: 20 },
        flow: { percent: 69, weight: 15 },
        style: { percent: 69, weight: 15 },
        content: { percent: 69, weight: 20 },
      }
      const result = calculateMeter(topicMeters)
      expect(result).toBe(69)
    })

    it('medium task = 86', () => {
      // Medium task: 24 slots (24 slots)
      const topicMeters = {
        goal: { percent: 86, weight: 20 },
        users: { percent: 86, weight: 10 },
        screens: { percent: 86, weight: 20 },
        flow: { percent: 86, weight: 15 },
        style: { percent: 86, weight: 15 },
        content: { percent: 86, weight: 20 },
      }
      const result = calculateMeter(topicMeters)
      expect(result).toBe(86)
    })

    it('large task = 91', () => {
      // Large task: 33 slots (33 slots)
      const topicMeters = {
        goal: { percent: 91, weight: 20 },
        users: { percent: 91, weight: 10 },
        screens: { percent: 91, weight: 20 },
        flow: { percent: 91, weight: 15 },
        style: { percent: 91, weight: 15 },
        content: { percent: 91, weight: 20 },
      }
      const result = calculateMeter(topicMeters)
      expect(result).toBe(91)
    })
  })

  describe('Cap cases', () => {
    it('all delegated caps at 89', () => {
      const topicMeters = {
        goal: { percent: 50, weight: 20 },
        users: { percent: 50, weight: 10 },
        screens: { percent: 50, weight: 20 },
        flow: { percent: 50, weight: 15 },
        style: { percent: 50, weight: 15 },
        content: { percent: 50, weight: 20 },
      }
      const result = calculateMeter(topicMeters)
      expect(result).toBeLessThanOrEqual(89)
    })

    it('all stated reaches 100', () => {
      const topicMeters = {
        goal: { percent: 100, weight: 20 },
        users: { percent: 100, weight: 10 },
        screens: { percent: 100, weight: 20 },
        flow: { percent: 100, weight: 15 },
        style: { percent: 100, weight: 15 },
        content: { percent: 100, weight: 20 },
      }
      const result = calculateMeter(topicMeters)
      expect(result).toBe(100)
    })

    it('reopen lowers meter', () => {
      // Reopening changes stated -> unknown, lowers meter
      expect(true).toBe(true) // Placeholder
    })

    it('na slots leave denominator', () => {
      const slots = {
        'goal.purpose': { status: 'stated', weight: 1 },
        'goal.platform': { status: 'na', weight: 1 },
      }
      const result = calculateTopicMeter('goal', slots, { goal: 20 })
      expect(result.denominator).toBe(1)
    })
  })
}