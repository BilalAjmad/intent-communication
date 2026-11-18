import { z } from "zod";

/**
 * trd 13.6 — scene-wide @keyframes table. Additive to scene metadata; the
 * exporters emit it inside @media (prefers-reduced-motion: no-preference).
 * Closed grammars bound name, offset, property and value; engine-side values
 * pass sanitizeCssValue as well (defense in depth).
 */

const KEYFRAME_NAME = /^[A-Za-z_][A-Za-z0-9_-]{0,63}$/;
const KEYFRAME_OFFSET = /^(from|to|(100|[0-9]{1,2})(\.\d+)?%)$/;
const KEYFRAME_PROPERTY = /^(--[a-zA-Z0-9_-]+|-?[a-z][a-z0-9-]*)$/;

export const KeyframesSchema = z.record(
  z.string().regex(KEYFRAME_NAME).max(64),
  z.record(
    z.string().regex(KEYFRAME_OFFSET).max(16),
    z.record(z.string().regex(KEYFRAME_PROPERTY).max(64), z.string().min(1).max(200)),
  ),
).refine((v) => Object.keys(v).length <= 32, { message: "at most 32 keyframes per scene" })
 .refine((v) => JSON.stringify(v).length <= 64 * 1024, { message: "keyframes exceed the 64 KB limit" });

export type Keyframes = z.infer<typeof KeyframesSchema>;
