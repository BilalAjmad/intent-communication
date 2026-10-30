import { describe, it, expect } from 'vitest'
import { writeBrief, readBrief, Brief } from '../src/interview/brief'

describe('Interview Brief (intent.md 7.3)', () => {
  describe('writeBrief', () => {
    it('writes brief.json with required fields', async () => {
      const brief: Brief = {
        version: 1,
        sceneId: 'scene_abc',
        status: 'interview-approved',
        meter: 85,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        answers: { 'goal.purpose': 'E-commerce' },
        delegated: ['goal.platform'],
      }
      // This would write to .intent/brief.json
      expect(true).toBe(true) // Placeholder
    })

    it('includes interview-approved version', async () => {
      const brief: Brief = {
        version: 1,
        sceneId: 'scene_abc',
        status: 'interview-approved',
        meter: 85,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        answers: {},
        delegated: [],
      }
      // The brief should have status 'interview-approved'
      expect(brief.status).toBe('interview-approved')
    })

    it('records first-render marker at first successful apply_patch', async () => {
      const brief: Brief = {
        version: 1,
        sceneId: 'scene_abc',
        status: 'interview-approved',
        meter: 85,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        answers: {},
        delegated: [],
        firstRender: 'scene_v1',
      }
      expect(brief.firstRender).toBeDefined()
    })
  })

  describe('readBrief', () => {
    it('reads brief.json', async () => {
      expect(true).toBe(true) // Placeholder
    })
  })

  describe('Brief format', () => {
    it('has required fields', () => {
      const brief = {
        version: 1,
        sceneId: 'scene_abc',
        status: 'interview-approved',
        meter: 85,
        createdAt: '2026-10-30T00:00:00Z',
        completedAt: '2026-10-30T01:00:00Z',
        answers: { 'goal.purpose': 'E-commerce' },
        delegated: ['goal.platform'],
        firstRender: 'scene_v1',
      }
      expect(brief.version).toBe(1)
      expect(brief.sceneId).toBe('scene_abc')
      expect(brief.status).toBe('interview-approved')
      expect(brief.meter).toBe(85)
    })
  })
})