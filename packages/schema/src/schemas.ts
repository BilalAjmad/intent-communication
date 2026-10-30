/**
// Op schemas
export const CreateOpSchema = z.object({
  type: z.literal('create'),
  objectId: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/),
  objectType: z.enum(['frame', 'text', 'image', 'vector', 'component']),
  parentId: z.string(),
  rect: RectSchema,
  props: z.record(z.unknown()),
})

export const UpdateOpSchema = z.object({
  type: z.literal('update'),
  objectId: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/),
  props: z.record(z.unknown()),
})

export const DeleteOpSchema = z.object({
  type: z.literal('delete'),
  objectId: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/),
})

export const MoveOpSchema = z.object({
  type: z.literal('move'),
  objectId: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/),
  newParentId: z.string().optional(),
  rect: RectSchema.optional(),
  index: z.number().int().optional(),
})

export const LockOpSchema = z.object({
  type: z.literal('lock'),
  objectId: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/),
})

export const UnlockOpSchema = z.object({
  type: z.literal('unlock'),
  objectId: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/),
})

export const OpSchema = z.discriminatedUnion('type', [
  CreateOpSchema,
  UpdateOpSchema,
  DeleteOpSchema,
  MoveOpSchema,
  LockOpSchema,
  z.object({ type: z.literal('unlock'), objectId: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/) }),
])

// Patch schema (closed grammar)
export const PatchSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/),
  baseRevision: z.number().int().nonnegative(),
  ops: z.array(OpSchema),
}).strict()

// Error schemas
export const ErrorCodeSchema = z.enum([
  'E_SCHEMA', 'E_LINT', 'E_LOCKED', 'E_CONFLICT', 'E_BUSY',
  'E_NOT_FOUND', 'E_BAD_REQUEST', 'E_IO', 'E_VERSION',
  'E_AUTH', 'E_LIMIT',
])

export const ErrorBodySchema = z.object({
  code: z.enum([
    'E_SCHEMA', 'E_LINT', 'E_LOCKED', 'E_CONFLICT', 'E_BUSY',
    'E_NOT_FOUND', 'E_BAD_REQUEST', 'E_IO', 'E_VERSION',
    'E_AUTH', 'E_LIMIT',
  ]),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  hint: z.string().optional(),
}).strict()

// Config schema (trd 15)
export const ConfigSchema = z.object({
  version: z.literal(1),
  scene: z.object({
    maxObjects: z.number().int().positive().max(10000),
    maxDepth: z.number().int().positive().max(100),
  }),
  lock: z.object({
    timeoutMs: z.number().int().positive().max(60000),
    maxRetries: z.number().int().nonnegative().max(10),
  }),
  write: z.object({
    atomic: z.boolean(),
    coalesceMs: z.number().int().nonnegative().max(1000),
  }),
  interview: z.object({
    maxQuestions: z.number().int().positive().max(20),
    defaultMode: z.enum(['full', 'quick', 'refine']),
  }),
  server: z.object({
    port: z.number().int().positive().max(65535),
    host: z.string().ip(),
  }),
  mcp: z.object({
    maxBytes: z.number().int().positive().max(1048576),
  }),
  linter: z.object({
    strict: z.boolean(),
  }),
}).strict()

// Interview state schema
export const InterviewStateSchema = z.object({
  status: z.enum(['none', 'active', 'paused', 'completed', 'aborted']),
  meter: z.number().min(0).max(1),
  currentQuestion: z.string().nullable(),
  delegated: z.array(z.string()),
  answers: z.record(z.string()),
  reopen: z.array(z.string()),
}).strict()

// Migration schema (trd 19)
export const MigrationSchema = z.object({
  fromVersion: z.number().int().nonnegative(),
  toVersion: z.number().int().positive(),
  up: z.function().optional(),
  down: z.function().optional(),
}).strict()

// Export all schemas
export const Schemas = {
  Point: PointSchema,
  Rect: RectSchema,
  Color: ColorSchema,
  ObjectType: ObjectTypeSchema,
  SceneObject: SceneObjectSchema,
  Lock: LockSchema,
  Scene: SceneSchema,
  CreateOp: CreateOpSchema,
  UpdateOp: UpdateOpSchema,
  DeleteOp: DeleteOpSchema,
  MoveOp: MoveOpSchema,
  LockOp: LockOpSchema,
  UnlockOp: z.object({ type: z.literal('unlock'), objectId: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/) }),
  Op: OpSchema,
  Patch: PatchSchema,
  ErrorCode: ErrorCodeSchema,
  ErrorBody: ErrorBodySchema,
  Config: ConfigSchema,
  InterviewState: InterviewStateSchema,
  Migration: MigrationSchema,
}
 * Zod Schemas - Closed Grammars (trd 5.1-5.4)
 * All schemas reject unknown properties (closed grammars).
 */

import { z } from 'zod'
import { Point, Rect, Color } from './primitives'
import { SceneObject, ObjectType, Scene, Lock } from './scene-types'
import { Op, Patch, CreateOp, UpdateOp, DeleteOp, MoveOp, LockOp, UnlockOp } from './patch-ops'
import { ErrorCode, ErrorBody } from './errors'
import { Config } from './config'
import { InterviewState } from './state-locks-versions'
import { Migration } from './migration-scaffold'

// Primitive schemas
export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
})

export const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
})

export const ColorSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
  a: z.number().min(0).max(1),
})

// ObjectType schema (closed grammar - only M1 types allowed)
export const ObjectTypeSchema = z.enum(['frame', 'text', 'image', 'vector', 'component'])

// SceneObject schema
export const SceneObjectSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/),
  type: z.enum(['frame', 'text', 'image', 'vector', 'component']),
  parentId: z.string(),
  rect: RectSchema,
  children: z.array(z.string()),
  props: z.record(z.unknown()),
})

// Lock schema
export const LockSchema = z.object({
  objectId: z.string(),
  lockedBy: z.string(),
  timestamp: z.number().int().positive(),
})

// Scene schema (closed grammar)
export const SceneSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/),
  version: z.number().int().nonnegative(),
  rootId: z.string().regex(/^[a-z][a-z0-9]*_[a-z0-9]+$/),
  objects: z.array(SceneObjectSchema),
  locks: z.array(LockSchema),
}).strict()