/**
 * Interview Meter (intent.md 7.2)
 * Meter calculation for interview progress tracking.
 */

export type SlotStatus = 'unknown' | 'stated' | 'delegated' | 'na' | 'reopened'

export interface SlotInfo {
  status: SlotStatus
  weight: number
  fatigueHint?: string
}

export interface TopicMeter {
  percent: number
  weight: number
  numerator: number
  denominator: number
}

export interface MeterResult {
  percent: number
  topicMeters: Record<string, TopicMeter>
}

/**
 * Calculate topic meter from slot statuses.
 * Formula: (stated * 1.0 + delegated * 0.5 + unknown * 0 + na * 0) / (stated + delegated + unknown)
 * na slots are excluded from denominator.
 */
export function calculateTopicMeter(
  topic: string,
  slots: Record<string, SlotInfo>,
  topicWeights: Record<string, number>
): TopicMeter {
  const relevantSlots = Object.entries(slots).filter(([key]) => key.startsWith(topic + '.'))

  let numerator = 0
  let denominator = 0

  for (const [, slot] of relevantSlots) {
    if (slot.status === 'na') {
      continue // na slots excluded from denominator
    }
    denominator += slot.weight

    switch (slot.status) {
      case 'stated':
        numerator += slot.weight * 1.0
        break
      case 'delegated':
        numerator += slot.weight * 0.5
        break
      case 'unknown':
      case 'reopened':
        numerator += 0
        break
    }
  }

  const percent = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0

  return {
    percent,
    weight: topicWeights[topic] || 0,
    numerator,
    denominator,
  }
}

/**
 * Calculate overall meter from topic meters.
 * Weighted average of topic percents.
 * Required topic cap: if any required topic (goal, users, screens, flow, content) is at 0%, cap at 89.
 */
export function calculateMeter(topicMeters: Record<string, TopicMeter>): number {
  // Check required topic cap
  const requiredTopics = ['goal', 'users', 'screens', 'flow', 'content']
  for (const topic of requiredTopics) {
    if (topicMeters[topic] && topicMeters[topic].percent === 0) {
      return Math.min(89, calculateWeightedAverage(topicMeters))
    }
  }

  return calculateWeightedAverage(topicMeters)
}

function calculateWeightedAverage(topicMeters: Record<string, TopicMeter>): number {
  let totalWeight = 0
  let weightedSum = 0

  for (const [, meter] of Object.entries(topicMeters)) {
    totalWeight += meter.weight
    weightedSum += meter.percent * meter.weight
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
}

/**
 * Apply delegation to slots.
 */
export function applyDelegation(
  slots: Record<string, SlotInfo>,
  slotIds: string[]
): Record<string, SlotInfo> {
  const result = { ...slots }
  for (const id of slotIds) {
    if (result[id]) {
      result[id] = { ...result[id], status: 'delegated' }
    }
  }
  return result
}

/**
 * Apply stated answers to slots.
 */
export function applyStated(
  slots: Record<string, SlotInfo>,
  slotIds: string[]
): Record<string, SlotInfo> {
  const result = { ...slots }
  for (const id of slotIds) {
    if (result[id]) {
      result[id] = { ...result[id], status: 'stated' }
    }
  }
  return result
}

/**
 * Apply reopen to slots (changes stated -> unknown).
 */
export function applyReopen(
  slots: Record<string, SlotInfo>,
  slotIds: string[]
): Record<string, SlotInfo> {
  const result = { ...slots }
  for (const id of slotIds) {
    if (result[id]) {
      result[id] = { ...result[id], status: 'unknown' }
    }
  }
  return result
}

/**
 * Apply fatigue hint after SC-4 threshold (5 questions).
 */
export function applyFatigue(
  slots: Record<string, SlotInfo>,
  questionCount: number
): Record<string, SlotInfo> {
  if (questionCount < 5) {
    return slots
  }

  const result = { ...slots }
  for (const [id, slot] of Object.entries(result)) {
    if (slot.status === 'unknown' && !slot.fatigueHint) {
      result[id] = {
        ...slot,
        fatigueHint: 'You seem tired. Want to take a break?',
      }
    }
  }
  return result
}

/**
 * Apply caps to meter (required topic at 0% caps at 89).
 */
export function applyCaps(topicMeters: Record<string, TopicMeter>): number {
  const requiredTopics = ['goal', 'users', 'screens', 'flow', 'content']
  for (const topic of requiredTopics) {
    if (topicMeters[topic] && topicMeters[topic].percent === 0) {
      return Math.min(89, calculateWeightedAverage(topicMeters))
    }
  }
  return calculateWeightedAverage(topicMeters)
}

/**
 * Agent percent vs server percent: agent cannot exceed server.
 */
export function applyAgentServerCap(agentPercent: number, serverPercent: number): number {
  return Math.min(agentPercent, serverPercent)
}