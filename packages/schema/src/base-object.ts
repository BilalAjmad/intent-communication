import { z } from "zod";
import { ObjectIdSchema } from "./primitives.js";

/**
 * Shared value + base-object schemas. Kept in their own module so the
 * object-type family can live in object-types.ts without a circular import.
 */
export const PrimitiveValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const TokenValueSchema = z.object({
  $type: z.literal("token"),
  $value: z.string(),
});

export const SceneValueSchema = z.union([
  PrimitiveValueSchema,
  TokenValueSchema,
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()).max(500),
]);

/**
 * trd 5.3 State representation: `states[name]` holds the override applied
 * while that state is active. Pseudo-states are driven by CSS pseudo-classes;
 * data states by a `data-state` attribute toggled by interactions (or the
 * preview's forced-state control).
 */
export const STATE_NAMES = [
  "hover",
  "pressed",
  "focus",
  "disabled",
  "visited",
  "checked",
  "filled",
  "loading",
  "error",
  "empty",
  "open",
  "success",
  "submitting",
  "content",
] as const;
export const StateNameSchema = z.enum(STATE_NAMES);
export type StateName = z.infer<typeof StateNameSchema>;

export const StateOverrideSchema = z.strictObject({
  style: z.record(z.string(), SceneValueSchema).optional(),
  props: z.record(z.string(), SceneValueSchema).optional(),
  visible: z.boolean().optional(),
  text: z.string().max(2000).optional(),
});
export type StateOverride = z.infer<typeof StateOverrideSchema>;

export const BaseObjectSchema = z.object({
  id: ObjectIdSchema,
  type: z.string().min(1),
  parentId: ObjectIdSchema.nullable(),
  children: z.array(ObjectIdSchema).max(200).default([]),
  props: z.record(z.string(), SceneValueSchema).default({}),
  style: z.record(z.string(), SceneValueSchema).default({}),
  meta: z.record(z.string(), z.unknown()).default({}),
  rev: z.number().int().nonnegative().optional(),
  states: z.partialRecord(StateNameSchema, StateOverrideSchema).default({}),
});
