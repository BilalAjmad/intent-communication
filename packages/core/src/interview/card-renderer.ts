/**
 * Plain-text Card Renderer (design 2.4)
 * Renders interview questions as plain-text cards.
 */

import { BankSeed } from './bank'

export interface CardData {
  question: string
  slot: string
  options: Array<{ id: string; label: string; description?: string }>
  hints?: string[]
  isControl?: boolean
  isDeepDive?: boolean
}

/**
 * Render a plain-text card for an interview question.
 * Includes fixed lines: "Don't know, you choose", "Skip", "Remember"
 * Includes source tags for summary.
 */
export function renderPlainTextCard(card: CardData): string {
  const lines: string[] = []

  // Question
  lines.push(card.question)
  lines.push('')

  // Options
  for (const option of card.options) {
    lines.push(`  ${option.id}: ${option.label}`)
    if (option.description) {
      lines.push(`      ${option.description}`)
    }
  }
  lines.push('')

  // Fixed lines (design 2.4)
  lines.push("  [Don't know, you choose]")
  lines.push('  [Skip]')
  lines.push('')

  // Remember hint
  lines.push('[Remember: Your answers shape the prototype. You can revise later.]')
  lines.push('')

  // Source tag for summary
  lines.push(`[source: ${card.slot}]`)

  if (card.isControl) {
    lines.push('[type: control]')
  }
  if (card.isDeepDive) {
    lines.push('[type: deep-dive]')
  }

  // Hints
  if (card.hints && card.hints.length > 0) {
    lines.push('')
    for (const hint of card.hints) {
      lines.push(`[hint: ${hint}]`)
    }
  }

  return lines.join('\n')
}

/**
 * Create a card from a bank seed.
 */
export function createCardFromSeed(seed: BankSeed): CardData {
  return {
    question: seed.whyAsked,
    slot: seed.slot,
    options: seed.options,
    hints: seed.default?.rule ? [`Default: ${seed.default.rule}`] : [],
    isControl: seed.type === 'control',
    isDeepDive: seed.type === 'deep-dive',
  }
}