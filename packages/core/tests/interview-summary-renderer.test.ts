import { describe, it, expect } from 'vitest'
import { renderSummary } from '../src/interview/summary-renderer'

describe('Summary Renderer (intent.md 7.3)', () => {
  describe('renderSummary', () => {
    it('includes source tags for each item', () => {
      const summary = {
        items: [
          { slot: 'goal.purpose', value: 'E-commerce', source: 'answer' },
          { slot: 'goal.platform', value: 'Web', source: 'delegated' },
          { slot: 'users.primary', value: 'Developers', source: 'prompt' },
        ],
        meter: 75,
        status: 'completed',
      }
      const rendered = renderSummary(summary)
      expect(rendered).toContain('goal.purpose')
      expect(rendered).toContain('answer')
      expect(rendered).toContain('delegated')
      expect(rendered).toContain('prompt')
    })

    it('includes quotes for harvested lines', () => {
      const summary = {
        items: [
          { slot: 'goal.purpose', value: 'E-commerce', source: 'answer', quote: 'I want to sell products online' },
        ],
        meter: 50,
        status: 'active',
      }
      const rendered = renderSummary(summary)
      expect(rendered).toContain('"I want to sell products online"')
    })

    it('shows meter percentage', () => {
      const summary = { items: [], meter: 75, status: 'completed' }
      const rendered = renderSummary(summary)
      expect(rendered).toContain('75%')
      expect(rendered).toContain('75')
    })

    it('shows status', () => {
      const summary = { items: [], meter: 50, status: 'active' }
      const rendered = renderSummary(summary)
      expect(rendered).toContain('active')
    })

    it('includes next topic suggestion', () => {
      const summary = {
        items: [{ slot: 'goal.purpose', value: 'E-commerce', source: 'answer' }],
        meter: 25,
        status: 'active',
        nextTopic: 'users.primary',
      }
      const rendered = renderSummary(summary)
      expect(rendered).toContain('users.primary')
    })

    it('handles low meter with fatigue hint', () => {
      const summary = {
        items: [],
        meter: 20,
        status: 'active',
        fatigueHint: 'You seem tired. Want to take a break?',
      }
      const rendered = renderSummary(summary)
      expect(rendered).toContain('tired')
    })
  })
})