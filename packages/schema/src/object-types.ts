import { z } from "zod";
import { BaseObjectSchema, SceneValueSchema } from "./base-object.js";

/**
 * M2.A object type family (checkbox … divider). Extracted from index.ts to
 * keep the per-file line budget; every schema here is a `BaseObjectSchema`
 * extension like the M1 core types, so the same defaults/validation apply.
 */
export const CheckboxSchema = BaseObjectSchema.extend({
  type: z.literal("checkbox"),
  props: z.object({
    label: z.string().max(500).default("Checkbox"),
    checked: z.boolean().default(false),
    name: z.string().max(100).optional(),
    disabled: z.boolean().default(false),
    onChange: z.string().max(1000).optional(),
  }).passthrough(),
});

export const RadioSchema = BaseObjectSchema.extend({
  type: z.literal("radio"),
  props: z.object({
    label: z.string().max(500).default("Option"),
    checked: z.boolean().default(false),
    name: z.string().max(100).optional(),
    value: z.string().max(200).optional(),
    disabled: z.boolean().default(false),
    onChange: z.string().max(1000).optional(),
  }).passthrough(),
});

export const SwitchSchema = BaseObjectSchema.extend({
  type: z.literal("switch"),
  props: z.object({
    label: z.string().max(500).default("Toggle"),
    checked: z.boolean().default(false),
    name: z.string().max(100).optional(),
    disabled: z.boolean().default(false),
    onChange: z.string().max(1000).optional(),
  }).passthrough(),
});

export const LinkSchema = BaseObjectSchema.extend({
  type: z.literal("link"),
  props: z.object({
    label: z.string().max(500).default("Link"),
    href: SceneValueSchema.optional(),
    target: z.enum(["_self", "_blank", "_parent", "_top"]).default("_self"),
    rel: z.string().max(200).optional(),
    onClick: z.string().max(1000).optional(),
  }).passthrough(),
});

export const ListSchema = BaseObjectSchema.extend({
  type: z.literal("list"),
  props: z.object({
    items: z.array(z.string().max(500)).max(100).default([]),
    ordered: z.boolean().default(false),
  }).passthrough(),
});

export const ModalSchema = BaseObjectSchema.extend({
  type: z.literal("modal"),
  props: z.object({
    title: z.string().max(500).default(""),
    size: z.enum(["sm", "md", "lg"]).default("md"),
    open: z.boolean().default(false),
  }).passthrough(),
});

export const IconSchema = BaseObjectSchema.extend({
  type: z.literal("icon"),
  props: z.object({
    icon: z.string().max(100).default("info"),
    size: z.number().int().positive().default(24),
    color: SceneValueSchema.optional(),
    label: z.string().max(200).optional(),
  }).passthrough(),
});

export const DividerSchema = BaseObjectSchema.extend({
  type: z.literal("divider"),
  props: z.object({
    direction: z.enum(["horizontal", "vertical"]).default("horizontal"),
    thickness: z.number().int().positive().default(1),
  }).passthrough(),
});
