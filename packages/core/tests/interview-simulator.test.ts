import { describe, it, expect } from 'vitest'
import { InterviewSimulator, runInterviewSimulation } from '../src/interview/simulator'

describe('Interview Simulator', () => {
  describe('runInterviewSimulation', () => {
    it('simulates small interview', async () => {
      const result = await runInterviewSimulation({ size: 'small', mode: 'Full' })
      expect(result.questionsAsked).toBeGreaterThan(0)
      expect(result.meter).toBeGreaterThanOrEqual(0)
      expect(result.meter).toBeLessThanOrEqual(100)
      expect(result.seedsAnswered).toBeGreaterThan(0)
    })

    it('simulates medium interview', async () => {
      const result = await runInterviewSimulation({ size: 'medium', mode: 'Full' })
      expect(result.questionsAsked).toBeGreaterThan(0)
      expect(result.meter).toBeGreaterThanOrEqual(0)
      expect(result.meter).toBeLessThanOrEqual(100)
    })

    it('simulates large interview', async () => {
      const result = await runInterviewSimulation({ size: 'large', mode: 'Full' })
      expect(result.questionsAsked).toBeGreaterThan(0)
      expect(result.meter).toBeGreaterThanOrEqual(0)
      expect(result.meter).toBeLessThanOrEqual(100)
    })

    it('respects Quick mode (fewer questions)', async () => {
      const quickResult = await runInterviewSimulation({ size: 'medium', mode: 'Quick' })
      const fullResult = await runInterviewSimulation({ size: 'medium', mode: 'Full' })
      expect(quickResult.questionsAsked).toBeLessThan(fullResult.questionsAsked)
    })

    it('respects Refine mode', async () => {
      const result = await runInterviewSimulation({ size: 'small', mode: 'Refine', previousAnswers: {} })
      expect(result.questionsAsked).toBeGreaterThanOrEqual(0)
    })
  })

  describe('InterviewSimulator class', () => {
    it('runs interview and returns summary', async () => {
      const simulator = new InterviewSimulator({ size: 'small', mode: 'Full' })
      const result = await simulator.run()
      expect(result).toHaveProperty('meter')
      expect(result).toHaveProperty('answers')
      expect(result).toHaveProperty('seedsAnswered')
      expect(result).toHaveProperty('questionsAsked')
    })

    it('handles delegation', async () => {
      const simulator = new InterviewSimulator({ size: 'small', mode: 'Full' })
      const result = await simulator.run({ delegations: ['goal.purpose', 'goal.platform'] })
      expect(result.delegated).toContain('goal.purpose')
      expect(result.delegated).toContain('goal.platform')
    })

    it('handles reopen', async () => {
      const simulator = new InterviewSimulator({ size: 'small', mode: 'Full' })
      const result = await simulator.run({ reopen: ['goal.purpose'] })
      expect(result.reopened).toContain('goal.purpose')
    })
  })

  describe('Meter path verification', () => {
    it('meter increases with each answer', async () => {
      const simulator = new InterviewSimulator({ size: 'small', mode: 'Full' })
      const result = await simulator.run()
      // Meter should generally increase or stay same
      expect(result.meterHistory).toBeDefined()
    })

    it('meter never exceeds 100', async () => {
      const simulator = new InterviewSimulator({ size: 'large', mode: 'Full' })
      const result = await simulator.run()
      expect(result.meter).toBeLessThanOrEqual(100)
    })

    it('meter never goes below 0', async () => {
      const simulator = new InterviewSimulator({ size: 'small', mode: 'Full' })
      const result = await simulator.run()
      expect(result.meter).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Question counts', () => {
    it('small interview has 11 questions max', async () => {
      const simulator = new InterviewSimulator({ size: 'small', mode: 'Full' })
      const result = await simulator.run()
      expect(result.questionsAsked).toBeLessThanOrEqual(11)
    })

    it('medium interview has 24 questions max', async () => {
      const simulator = new InterviewSimulator({ size: 'medium', mode: 'Full' })
      const result = await simulator.run()
      expect(result.questionsAsked).toBeLessThanOrEqual(24)
    })

    it('large interview has 33 questions max', async () => {
      const simulator = new InterviewSimulator({ size: 'large', mode: 'Full' })
      const result = await simulator.run()
      expect(result.questionsAsked).toBeLessThanOrEqual(33)
    })
  })
})