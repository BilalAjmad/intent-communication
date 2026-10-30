/**
 * Interview Brief (intent.md 7.3)
 * Writes and reads brief.json with interview-approved version.
 */

import { INTERVIEW_BANK } from './bank'

export interface Brief {
  version: number
  sceneId: string
  status: 'interview-approved' | 'draft' | 'archived'
  meter: number
  createdAt: string
  completedAt?: string
  answers: Record<string, string>
  delegated: string[]
  firstRender?: string
}

/**
 * Write brief.json to .intent/brief.json
 */
export async function writeBrief(brief: Brief): Promise<void> {
  // In real implementation, this would write to file system
  // For now, we just validate the brief structure
  validateBrief(brief)
}

function validateBrief(brief: Brief): void {
  if (brief.version !== 1) {
    throw new Error('Brief version must be 1')
  }
  if (!brief.sceneId) {
    throw new Error('Brief must have sceneId')
  }
  if (brief.status !== 'interview-approved' && brief.status !== 'draft' && brief.status !== 'archived') {
    throw new Error('Brief status must be interview-approved, draft, or archived')
  }
  if (brief.meter < 0 || brief.meter > 100) {
    throw new Error('Brief meter must be between 0 and 100')
  }
}

/**
 * Read brief.json from .intent/brief.json
 */
export async function readBrief(sceneId: string): Promise<Brief | null> {
  // In real implementation, this would read from file system
  return null
}

/**
 * Create brief from interview result.
 */
export function createBriefFromInterview(
  sceneId: string,
  meter: number,
  answers: Record<string, string>,
  delegated: string[],
  firstRender?: string
): Brief {
  return {
    version: 1,
    sceneId,
    status: 'interview-approved',
    meter,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    answers,
    delegated,
    firstRender,
  }
}

/**
 * Check if brief is interview-approved.
 */
export function isInterviewApproved(brief: Brief): boolean {
  return brief.status === 'interview-approved'
}

/**
 * Get seeds that were answered in the brief.
 */
export function getAnsweredSeeds(brief: Brief): string[] {
  return Object.keys(brief.answers)
}

/**
 * Get delegated slots from brief.
 */
export function getDelegatedSlots(brief: Brief): string[] {
  return brief.delegated
}