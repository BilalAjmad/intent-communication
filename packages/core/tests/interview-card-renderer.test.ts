import { describe, it, expect } from 'vitest'
import { renderPlainTextCard } from '../src/interview/card-renderer'

describe('Plain-text Card Renderer (design 2.4)', () => {
  describe('renderPlainTextCard', () => {
    it('renders question with options', () => {
      const card = {
        question: 'What is the primary purpose of your app?',
        slot: 'goal.purpose',
        options: [
          { id: 'option1', label: 'E-commerce', description: 'Sell products online' },
          { id: 'option2', label: 'SaaS', description: 'Software as a service' },
          { id: 'option3', label: 'Content', description: 'Blog, media, documentation' },
        ],
        hints: ['You can select multiple', 'This affects the interview flow'],
      }
      const rendered = renderPlainTextCard(card)
      expect(rendered).toContain('What is the primary purpose of your app?')
      expect(rendered).toContain('E-commerce')
      expect(rendered).toContain('SaaS')
      expect(rendered).toContain('Content')
    })

    it('includes fixed lines: "Don\\'t know, you choose"', () => {
      const card = {
        question: 'Test question?',
        slot: 'test.slot',
        options: [{ id: 'a', label: 'A' }],
      }
      const rendered = renderPlainTextCard(card)
      expect(rendered).toContain("Don't know, you choose")
    })

    it('includes fixed line: "Skip"', () => {
      const card = {
        question: 'Test question?',
        slot: 'test.slot',
        options: [{ id: 'a', label: 'A' }],
      }
      const rendered = renderPlainTextCard(card)
      expect(rendered).toContain('Skip')
    })

    it('includes remember hint', () => {
      const card = {
        question: 'Test question?',
        slot: 'test.slot',
        options: [{ id: 'a', label: 'A' }],
      }
      const rendered = renderPlainTextCard(card)
      expect(rendered).toContain('Remember')
    })

    it('includes source tags for summary', () => {
      const card = {
        question: 'Test question?',
        slot: 'goal.purpose',
        options: [{ id: 'a', label: 'A' }],
      }
      const rendered = renderPlainTextCard(card)
      expect(rendered).toContain('goal.purpose')
    })

    it('handles control questions (CT1-CT5)', () => {
      const card = {
        question: 'Control question?',
        slot: 'control.test',
        options: [{ id: 'a', label: 'A' }],
        isControl: true,
      }
      const rendered = renderPlainTextCard(card)
      expect(rendered).toContain('Control')
    })

    it('handles deep-dive questions', () => {
      const card = {
        question: 'Deep-dive question?',
        slot: 'edge.auth',
        options: [{ id: 'a', label: 'A' }],
        isDeepDive: true,
      }
      const rendered = renderPlainTextCard(card)
      expect(rendered).toContain('Deep-dive')
    })
  })
})