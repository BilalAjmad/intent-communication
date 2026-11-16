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

export const BaseObjectSchema = z.object({
  id: ObjectIdSchema,
  type: z.string().min(1),
  parentId: ObjectIdSchema.nullable(),
  children: z.array(ObjectIdSchema).max(200).default([]),
  props: z.record(z.string(), SceneValueSchema).default({}),
  style: z.record(z.string(), SceneValueSchema).default({}),
  meta: z.record(z.string(), z.unknown()).default({}),
  rev: z.number().int().nonnegative().optional(),
});
