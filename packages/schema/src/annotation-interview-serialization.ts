/**
 * Annotation Shell, Interview State, Canonical Serialization (trd 9.5)
 */

import { Scene, SceneObject, Lock } from './scene-types'
import { Patch } from './patch-ops'
import { InterviewState } from './state-locks-versions'

/**
 * Interview Bank Types (intent.md 6.3-6.5)
 */
export type SeedType = 'interview' | 'deep-dive' | 'control'
export type SeedTier = 'P1' | 'P2' | 'P3'
export type Milestone = 'M1' | 'M2' | 'M3'

export interface BankSeed {
  id: string
  slot: string
  type: SeedType
  tier: SeedTier
  since: Milestone
  whyAsked: string
  profileKey: string | null
  options: Array<{
    id: string
    label: string
    description?: string
  }>
  default: {
    rule?: string
    notDelegable?: boolean
  }
}

export interface Bank {
  version: number
  seeds: BankSeed[]
}

export interface Annotation {
  id: string
  objectId: string
  type: 'highlight' | 'comment' | 'measure'
  rect: { x: number; y: number; width: number; height: number }
  color: string
  createdAt: number
}

export interface AnnotationShell {
  annotations: Annotation[]
  viewport: { x: number; y: number; zoom: number }
  selectedIds: string[]
}

export function createAnnotation(partial: Partial<Annotation>): Annotation {
  return {
    id: `ann_${Date.now().toString(36)}`,
    objectId: partial.objectId || '',
    type: partial.type || 'highlight',
    rect: partial.rect || { x: 0, y: 0, width: 0, height: 0 },
    color: partial.color || '#ffff0080',
    createdAt: partial.createdAt || Date.now(),
  }
}

export function validateAnnotation(ann: Annotation): boolean {
  return !!ann.id && !!ann.objectId && ['highlight', 'comment', 'measure'].includes(ann.type)
}

export interface InterviewState {
  status: 'none' | 'active' | 'paused' | 'completed' | 'aborted'
  meter: number
  currentQuestion: string | null
  delegated: string[]
  answers: Record<string, string>
  reopen: string[]
}

export function createInterviewState(): InterviewState {
  return {
    status: 'none',
    meter: 0,
    currentQuestion: null,
    delegated: [],
    answers: {},
    reopen: [],
  }
}

export function validateInterviewState(state: InterviewState): boolean {
  if (!['none', 'active', 'paused', 'completed', 'aborted'].includes(state.status)) return false
  if (state.meter < 0 || state.meter > 1) return false
  if (!Array.isArray(state.delegated)) return false
  if (typeof state.answers !== 'object' || state.answers === null) return false
  if (!Array.isArray(state.reopen)) return false
  return true
}

/**
 * Canonical serialization (trd 9.5)
 * All serialization uses sorted keys for deterministic output.
 */

function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(sortKeys)
  const sorted: any = {}
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortKeys(obj[key])
  }
  return sorted
}

export function serializeScene(scene: any): string {
  return JSON.stringify(sortKeys(scene))
}

export function deserializeScene(json: string): any {
  return JSON.parse(json)
}

export function serializePatch(patch: any): string {
  return JSON.stringify(sortKeys(patch))
}

export function deserializePatch(json: string): any {
  return JSON.parse(json)
}

export function serializeInterviewState(state: any): string {
  return JSON.stringify(sortKeys(state))
}

export function deserializeInterviewState(json: string): any {
  return JSON.parse(json)
}

export function serializeAnnotation(ann: any): string {
  return JSON.stringify(sortKeys(ann))
}

export function deserializeAnnotation(json: string): any {
  return JSON.parse(json)
}

/**
 * Deterministic JSON serialization with sorted keys
 * Ensures byte-identical output across platforms (trd 9.5)
 */
export function canonicalJSON(obj: any): string {
  return JSON.stringify(sortKeys(obj))
}

export function parseCanonicalJSON(json: string): any {
  return JSON.parse(json)
}