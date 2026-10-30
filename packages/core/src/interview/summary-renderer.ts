/**
 * Summary Renderer (intent.md 7.3)
 * Renders interview summary with source tags and quotes.
 */

export interface SummaryItem {
  slot: string
  value: string
  source: 'answer' | 'delegated' | 'prompt'
  quote?: string
}

export interface SummaryData {
  items: SummaryItem[]
  meter: number
  status: 'active' | 'completed' | 'paused'
  nextTopic?: string
  fatigueHint?: string
}

/**
 * Render interview summary with source tags and quotes.
 */
export function renderSummary(data: SummaryData): string {
  const lines: string[] = []

  // Header
  lines.push('=== INTERVIEW SUMMARY ===')
  lines.push(`Meter: ${data.meter}%`)
  lines.push(`Status: ${data.status}`)
  lines.push('')

  // Items with source tags
  for (const item of data.items) {
    const sourceTag = `[${item.source}]`
    const quote = item.quote ? ` "${item.quote}"` : ''
    lines.push(`${item.slot}: ${item.value} ${sourceTag}${quote}`)
  }
  lines.push('')

  // Next topic suggestion
  if (data.nextTopic) {
    lines.push(`Next: ${data.nextTopic}`)
  }

  // Fatigue hint
  if (data.fatigueHint) {
    lines.push('')
    lines.push(`[${data.fatigueHint}]`)
  }

  lines.push('')
  lines.push('=== END ===')

  return lines.join('\n')
}

/**
 * Render brief summary (for brief.json).
 */
export function renderBriefSummary(data: SummaryData): string {
  const lines: string[] = []
  lines.push(`Meter: ${data.meter}%`)
  lines.push(`Status: ${data.status}`)
  lines.push('')
  for (const item of data.items) {
    const sourceTag = `[${item.source}]`
    lines.push(`${item.slot}: ${item.value} ${sourceTag}`)
  }
  return lines.join('\n')
}