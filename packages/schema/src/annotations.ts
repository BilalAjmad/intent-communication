import { z } from "zod";
import { CrockfordULIDSchema, ObjectIdSchema, ScreenIdSchema, ISODateTimeSchema } from "./primitives.js";

/**
 * trd 9.7 Annotations (M2.A).
 *
 * Vector data is always saved. PNGs are produced in the browser over a
 * screenshot of the target object's box (16 px margin, max edge 1280, max
 * 512 KB) and stored server-side (server hard cap 1 MB + magic-byte check).
 *
 * Annotations are stored flat per scene in .intent/annotations/<sceneId>.json
 * like the feedback queue. Agents only see `sent` (and `resolved`) annotation
 * summaries through get_feedback; `includeImageData: true` adds base64 bytes
 * for the first 3 images per call (trd 10.4).
 */
export const AnnotationIdSchema = CrockfordULIDSchema.refine((v) => v.startsWith("a_"), {
  message: "Annotation id must be an a_ id",
});

export const AnnotationPointSchema = z.tuple([
  z.number().finite().min(-10000).max(10000),
  z.number().finite().min(-10000).max(10000),
]);

export const AnnotationStrokeSchema = z.strictObject({
  color: z.enum(["red", "blue", "green", "black"]),
  width: z.union([z.literal(2), z.literal(4), z.literal(8)]),
  points: z.array(AnnotationPointSchema).min(2).max(500),
});
export type AnnotationStroke = z.infer<typeof AnnotationStrokeSchema>;

export const AnnotationImageSchema = z.strictObject({
  file: z.string().regex(/^a_[0-9A-HJKMNP-TV-Z]{26}\.png$/, {
    message: "image.file must be a_<ulid>.png",
  }),
  width: z.number().int().positive().max(4096),
  height: z.number().int().positive().max(4096),
  bytes: z.number().int().positive().max(1024 * 1024),
});
export type AnnotationImage = z.infer<typeof AnnotationImageSchema>;

export const AnnotationSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: AnnotationIdSchema,
  kind: z.enum(["pencil", "pin"]),
  objectId: ObjectIdSchema.nullable().default(null),
  screenId: ScreenIdSchema,
  anchor: z
    .strictObject({ x: z.number().finite(), y: z.number().finite() })
    .nullable()
    .default(null),
  strokes: z.array(AnnotationStrokeSchema).max(50).optional(),
  text: z.string().max(1000).optional(),
  image: AnnotationImageSchema.optional(),
  status: z.enum(["open", "sent", "resolved"]).default("open"),
  createdAt: ISODateTimeSchema,
});
export type Annotation = z.infer<typeof AnnotationSchema>;

/** Server assigns id, createdAt and status=open; the client sends the rest. */
export const CreateAnnotationInputSchema = z
  .strictObject({
    kind: z.enum(["pencil", "pin"]),
    objectId: ObjectIdSchema.nullable().default(null),
    screenId: ScreenIdSchema,
    anchor: z
      .strictObject({ x: z.number().finite(), y: z.number().finite() })
      .nullable()
      .default(null),
    strokes: z.array(AnnotationStrokeSchema).max(50).optional(),
    text: z.string().max(1000).optional(),
  })
  .refine(
    (v) => (v.kind === "pin" ? (v.text?.trim().length ?? 0) > 0 : (v.strokes?.length ?? 0) > 0),
    { message: "pin annotations need text; pencil annotations need strokes" },
  );
export type CreateAnnotationInput = z.infer<typeof CreateAnnotationInputSchema>;

/** Summary served to agents through get_feedback (trd 10.4). */
export const AnnotationSummarySchema = z.strictObject({
  id: AnnotationIdSchema,
  kind: z.enum(["pencil", "pin"]),
  objectId: ObjectIdSchema.nullable(),
  screenId: ScreenIdSchema,
  anchor: z.strictObject({ x: z.number().finite(), y: z.number().finite() }).nullable(),
  text: z.string().max(1000).optional(),
  status: z.enum(["sent", "resolved"]),
  image: AnnotationImageSchema.optional(),
  // base64 PNG, only with includeImageData: true and only for the first 3 images (trd 10.4).
  imageData: z.string().max(1_500_000).optional(),
});
export type AnnotationSummary = z.infer<typeof AnnotationSummarySchema>;
