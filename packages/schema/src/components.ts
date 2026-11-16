import { z } from "zod";
import { CrockfordULIDSchema, ObjectIdSchema, RevisionSchema } from "./primitives.js";

/**
 * trd 5.5 Components and instances (M2).
 *
 * ComponentDef: the reusable definition. Its subtree lives in the scene's flat
 * `objects` map under `objectIds`. Instances reference defs with
 * `componentRef`; the normalizer/exporter expands instances at render time
 * (never persisted — derived ids would not pass ObjectIdSchema).
 *
 * `ComponentRefSchema` lives in base-object.ts because it references
 * SceneValueSchema; this module holds the def-only schemas to avoid a cycle.
 */
export const ExposedPropSchema = z.strictObject({
  nodeId: ObjectIdSchema,
  // JSON Pointer into the node's props/style, e.g. "/props/label". Max 200 chars.
  path: z.string().min(1).max(200),
});

export const ComponentDefSchema = z.strictObject({
  id: CrockfordULIDSchema.refine((v) => v.startsWith("c_"), {
    message: "Component id must be a c_ id",
  }),
  name: z.string().min(1).max(60),
  rev: RevisionSchema,
  rootId: ObjectIdSchema,
  objectIds: z.array(ObjectIdSchema).max(2000),
  exposedProps: z.record(z.string().max(60), ExposedPropSchema).default({}),
});
export type ComponentDef = z.infer<typeof ComponentDefSchema>;
