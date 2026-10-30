/**
 * Ops - Core operation types (trd 6)
 * Re-exports from schema for convenience.
 */

export { OpType, Op, CreateOp, UpdateOp, DeleteOp, MoveOp, LockOp, UnlockOp, Patch } from '@intent/schema'

// Re-export OpType values for convenience
export type { OpType, CreateOp, UpdateOp, DeleteOp, MoveOp, LockOp, UnlockOp, Op, Patch } from '@intent/schema'