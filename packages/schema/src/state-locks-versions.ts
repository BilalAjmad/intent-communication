/**
 * State, Locks, Versions
 * Core state management types.
 */

import { Scene, Lock, createScene } from './scene-types'
import { Patch } from './patch-ops'

export interface State {
  scene: Scene
  revision: number
  interview: InterviewState
}

export interface InterviewState {
  status: 'none' | 'active' | 'paused' | 'completed' | 'aborted'
  meter: number // 0-1
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
  if (!Array.isArray(state.answers)) return false
  if (!Array.isArray(state.reopen)) return false
  return true
}

export function createState(): State {
  return {
    scene: createScene(),
    revision: 0,
    interview: createInterviewState(),
  }
}

export function validateState(state: State): boolean {
  if (!state.scene || typeof state.revision !== 'number') return false
  if (state.revision < 0) return false
  // Scene validation would be imported
  return true
}

/**
 * Locks management
 */
export interface Locks {
  objects: Record<string, { objectId: string; lockedBy: string; timestamp: number }>
  order: string[]
}

export function createLocks(): Locks {
  return { objects: {}, order: [] }
}

export function validateLocks(locks: any): boolean {
  if (!locks || typeof locks !== 'object') return false
  if (!locks.objects || typeof locks.objects !== 'object') return false
  if (!Array.isArray(locks.order)) return false
  // All keys in order must exist in objects
  for (const key of locks.order) {
    if (!locks.objects[key]) return false
  }
  // All objects must be in order (no orphaned locks)
  for (const key of Object.keys(locks.objects)) {
    if (!locks.order.includes(key)) return false
  }
  return true
}

/**
 * Versions management
 */
export interface Versions {
  current: number
  history: Array<{
    version: number
    timestamp: number
    sceneHash: string
    patchId: string
  }>
}

export function createVersions(): any {
  return { current: 0, history: [] }
}

export function validateVersions(versions: any): boolean {
  if (!versions || typeof versions !== 'object') return false
  if (typeof versions.current !== 'number' || versions.current < 0) return false
  if (!Array.isArray(versions.history)) return false
  // History should be sequential from 1 to current (or less, but no gaps)
  if (versions.current > 0 && versions.history.length > versions.current) return false
  for (let i = 0; i < versions.history.length; i++) {
    const h = versions.history[i]
    if (h.version !== i + 1) return false
    if (typeof h.timestamp !== 'number' || typeof h.sceneHash !== 'string' || typeof h.patchId !== 'string') return false
  }
  return true
}