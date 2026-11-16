import { z } from "zod";

export const DesignSourceSchema = z.object({
  kind: z.enum(["tailwind", "shadcn", "css-variables", "token-json", "storybook", "components"]),
  file: z.string().max(512),
  confidence: z.enum(["high", "medium", "low"]),
});
export type DesignSource = z.infer<typeof DesignSourceSchema>;

export const UnresolvedEntrySchema = z.object({
  file: z.string().max(512),
  key: z.string().max(512),
  reason: z.string().max(512),
});
export type UnresolvedEntry = z.infer<typeof UnresolvedEntrySchema>;

export const DesignProfileSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  sources: z.array(DesignSourceSchema),
  tokens: z.object({
    colors: z.record(z.string(), z.string()).default({}),
    spacing: z.record(z.string(), z.string()).default({}),
    radii: z.record(z.string(), z.string()).default({}),
    fontFamily: z.record(z.string(), z.string()).default({}),
    fontSize: z.record(z.string(), z.string()).default({}),
  }),
  grid: z.object({ spacing: z.number().int().positive() }).optional(),
  components: z
    .array(
      z.object({
        role: z.string().max(64),
        importPath: z.string().max(512),
        exportName: z.string().max(512),
        propMap: z.record(z.string(), z.string()).default({}),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .default([]),
  tailwind: z
    .object({
      // hex (lowercase, with #) -> the token path it came from
      colorMap: z.record(z.string(), z.string()).default({}),
      // px string -> spacing token path
      spacingMap: z.record(z.string(), z.string()).default({}),
      // px string -> radius token path
      radiusMap: z.record(z.string(), z.string()).default({}),
    })
    .optional(),
  unresolved: z.array(UnresolvedEntrySchema).default([]),
});
export type DesignProfile = z.infer<typeof DesignProfileSchema>;

export interface ScanResult {
  profile: DesignProfile;
  /** Where the profile was written, when writeTo is passed. */
  writtenTo: string | null;
}
