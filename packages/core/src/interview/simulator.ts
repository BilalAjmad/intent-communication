/**
 * Interview Simulator (intent.md)
 * Scripted agent against real core for testing.
 */

import { INTERVIEW_BANK, getSeedsByTopic } from './bank'
import {
  calculateMeter,
  calculateTopicMeter,
  applyDelegation,
  applyStated,
  applyReopen,
  applyFatigue,
  SlotInfo,
  TopicMeter,
} from './meter'

export interface InterviewConfig {
  size: 'small' | 'medium' | 'large'
  mode: 'Full' | 'Quick' | 'Refine'
  previousAnswers?: Record<string, string>
  delegations?: string[]
  reopen?: string[]
}

export interface InterviewResult {
  meter: number
  answers: Record<string, string>
  delegated: string[]
  reopened: string[]
  seedsAnswered: number
  questionsAsked: number
  meterHistory: number[]
  topicMeters: Record<string, TopicMeter>
  status: 'active' | 'completed' | 'paused'
}

export interface InterviewSummary {
  items: Array<{
    slot: string
    value: string
    source: 'answer' | 'delegated' | 'prompt'
    quote?: string
  }>
  meter: number
  status: 'active' | 'completed' | 'paused'
  nextTopic?: string
  fatigueHint?: string
}
/**
 * Interview Simulator for testing.
 * Runs a scripted interview against the real core logic.
 */
export class InterviewSimulator {
  private config: InterviewConfig
  private slots: Record<string, SlotInfo> = {}
  private answers: Record<string, string> = {}
  private delegated: string[] = []
  private reopened: string[] = []
  private meterHistory: number[] = []
  private questionCount = 0

  private topicWeights = {
    goal: 20,
    users: 10,
    screens: 20,
    flow: 15,
    style: 15,
    content: 20,
  }

  private sizeSeeds = {
    small: ['goal', 'users', 'screens', 'flow'],
    medium: ['goal', 'users', 'screens', 'flow', 'style', 'content'],
    large: ['goal', 'users', 'screens', 'flow', 'style', 'content', 'edge'],
  }

  constructor(config: InterviewConfig) {
    this.config = config
    this.initializeSlots()
  }

  private initializeSlots(): void {
    const bank = INTERVIEW_BANK
    const topics = this.sizeSeeds[this.config.size]

    for (const topic of topics) {
      const seeds = bank.seeds.filter(
        s => (s.type === 'interview' || s.type === 'deep-dive') && s.id.startsWith(topic + '.')
      )
      for (const seed of seeds) {
        this.slots[seed.id] = { status: 'unknown', weight: 1 }
      }
    }

    for (const seed of bank.seeds) {
      if (seed.type === 'control') {
        this.slots[seed.id] = { status: 'unknown', weight: 1 }
      }
    }

    if (this.config.previousAnswers) {
      for (const [slotId, value] of Object.entries(this.config.previousAnswers)) {
        if (this.slots[slotId]) {
          this.slots[slotId] = { ...this.slots[slotId], status: 'stated' }
          this.answers[slotId] = value
        }
      }
    }

    if (this.config.delegations) {
      this.slots = applyDelegation(this.slots, this.config.delegations)
      this.delegated = [...this.config.delegations]
    }

    if (this.config.reopen) {
      this.slots = applyReopen(this.slots, this.config.reopen)
      this.reopened = [...this.config.reopen]
    }
  }

  async run(): Promise<InterviewResult> {
    const topics = this.sizeSeeds[this.config.size]
    const bank = INTERVIEW_BANK

    for (const topic of topics) {
      const seeds = bank.seeds.filter(
        s => (s.type === 'interview' || s.type === 'deep-dive') && s.id.startsWith(topic + '.')
      )

      const availableSeeds = seeds.filter(s => {
        if (this.config.size === 'small') return s.since === 'M1'
        if (this.config.size === 'medium') return s.since !== 'M3'
        return true
      })

      for (const seed of availableSeeds) {
        if (this.config.mode === 'Quick' && seed.tier !== 'P1') {
          continue
        }

        if (this.slots[seed.id]?.status === 'unknown') {
          this.questionCount++
          this.slots = applyFatigue(this.slots, this.questionCount)
          this.simulateAnswer(seed)
          this.updateMeter()
        }
      }

      if (this.config.mode !== 'Quick') {
        const controlSeeds = bank.seeds.filter(s => s.type === 'control')
        for (const seed of controlSeeds) {
          this.questionCount++
          this.slots = applyFatigue(this.slots, this.questionCount)
          this.simulateControlAnswer(seed)
          this.updateMeter()
        }
      }
    }

    return this.buildResult()
  }

  private simulateAnswer(seed: any): void {
    const option = seed.options[0] || { id: 'default', label: 'Default' }
    this.answers[seed.id] = option.label
    this.slots[seed.id] = { ...this.slots[seed.id], status: 'stated' }
  }

  private simulateControlAnswer(seed: any): void {
    const correctOption = seed.options.find((o: any) => o.id === 'skip' || o.id === 'correct')
    if (correctOption) {
      this.answers[seed.id] = correctOption.label
      this.slots[seed.id] = { ...this.slots[seed.id], status: 'stated' }
    }
  }

  private updateMeter(): void {
    const topicMeters: Record<string, TopicMeter> = {}
    for (const topic of Object.keys(this.topicWeights)) {
      topicMeters[topic] = calculateTopicMeter(topic, this.slots, this.topicWeights)
    }
    const meter = calculateMeter(topicMeters)
    this.meterHistory.push(meter)
  }

  private buildResult(): InterviewResult {
    const topicMeters: Record<string, TopicMeter> = {}
    for (const topic of Object.keys(this.topicWeights)) {
      topicMeters[topic] = calculateTopicMeter(topic, this.slots, this.topicWeights)
    }

    return {
      meter: this.meterHistory[this.meterHistory.length - 1] || 0,
      answers: this.answers,
      delegated: this.delegated,
      reopened: this.reopened,
      seedsAnswered: Object.keys(this.answers).length,
      questionsAsked: this.questionCount,
      meterHistory: this.meterHistory,
      topicMeters,
      status: 'completed',
    }
  }

  getSummary(): InterviewSummary {
    const items = Object.entries(this.answers).map(([slot, value]) => ({
      slot,
      value,
      source: this.delegated.includes(slot) ? 'delegated' : 'answer',
    }))

    const meter = this.meterHistory[this.meterHistory.length - 1] || 0

    let nextTopic: string | undefined
    for (const topic of Object.keys(this.topicWeights)) {
      const topicSlots = Object.entries(this.slots).filter(([key]) => key.startsWith(topic + '.'))
      const hasUnknown = topicSlots.some(([, slot]) => slot.status === 'unknown')
      if (hasUnknown) {
        nextTopic = topic
        break
      }
    }

    const fatigueSlot = Object.entries(this.slots).find(([, slot]) => slot.fatigueHint)
    const fatigueHint = fatigueSlot?.[1]?.fatigueHint

    return {
      items,
      meter,
      status: 'completed',
      nextTopic,
      fatigueHint,
    }
  }
}

/**
 * Run interview simulation with given config.
 */
export async function runInterviewSimulation(config: InterviewConfig): Promise<InterviewResult> {
  const simulator = new InterviewSimulator(config)
  return simulator.run()
}
