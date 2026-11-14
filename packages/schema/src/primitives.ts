import { z } from "zod";

// Shared schema primitives (extracted so every module can import them without cycles).
export const CrockfordULIDSchema = z.string().regex(/^(o|s|c|p|a|q|v|k)_[0-9A-HJKMNP-TV-Z]{26}$/, { message: "Must be a valid prefixed Crockford ULID (prefix_<26 Crockford base32 chars>)" });

export const ISODateTimeSchema = z.string().datetime({ offset: true }).refine((val) => val.endsWith("Z"), { message: "Must be UTC (end with Z)" });

export const RevisionSchema = z.number().int().nonnegative();

export const ObjectIdSchema = CrockfordULIDSchema;

export const ScreenIdSchema = CrockfordULIDSchema;
export const ChipSchema = z.enum(["bigger", "smaller", "more-space", "less-clutter", "different-color", "more-premium", "simpler"]);
export type Chip = z.infer<typeof ChipSchema>;
export const SafeIdSchema = z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/, { message: "Must be a path-safe id (letters, digits, underscore, hyphen)" });
