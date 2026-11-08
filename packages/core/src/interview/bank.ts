import { z } from "zod";

export const SeedSchema = z.object({
  seedId: z.string().min(1),
  tier: z.enum(["P1", "P2", "P3"]),
  since: z.enum(["M1", "M2", "M3"]),
  slot: z.string().nullable(),
  question: z.string().min(1),
  options: z.array(z.object({
    id: z.string().min(1).max(20),
    label: z.string().min(1).max(80),
  })).min(2).max(5),
  default: z.string().min(1),
  whyAsked: z.string().min(1),
  profileKey: z.string().nullable(),
  dynamicOptions: z.literal("screens").nullable().optional(),
});

export const ControlSeedSchema = z.object({
  seedId: z.string().min(1),
  label: z.string().min(1),
  when: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.object({
    id: z.string().min(1).max(20),
    label: z.string().min(1).max(80),
  })).min(2).max(5),
});

export type Seed = z.infer<typeof SeedSchema>;
export type ControlSeed = z.infer<typeof ControlSeedSchema>;

export const INTERVIEW_SEEDS: Seed[] = [
  { seedId: "F1", tier: "P1", since: "M1", slot: "flow.main", question: "What is the primary user goal? Task completion / Information browsing / Social interaction / Something else", options: [{ id: "task", label: "Task completion" }, { id: "browse", label: "Information browsing" }, { id: "social", label: "Social interaction" }, { id: "other", label: "Something else" }], default: "task", whyAsked: "Defines the main journey shape", profileKey: "goal.purpose" },
  { seedId: "F2", tier: "P2", since: "M1", slot: "flow.after", question: "What happens after the primary goal? Return to start / Show related / Nothing", options: [{ id: "return", label: "Return to start" }, { id: "related", label: "Show related" }, { id: "nothing", label: "Nothing" }], default: "return", whyAsked: "Determines post-goal behavior", profileKey: "flow.after" },
  { seedId: "F3", tier: "P2", since: "M1", slot: "flow.links", question: "How do screens connect? Linear / Hub-and-spoke / Free navigation", options: [{ id: "linear", label: "Linear" }, { id: "hub", label: "Hub-and-spoke" }, { id: "free", label: "Free navigation" }], default: "linear", whyAsked: "Sets navigation topology", profileKey: "flow.links" },
  { seedId: "F4", tier: "P3", since: "M2", slot: "flow.back", question: "Is there a back or cancel action? Global back / Per-screen / None", options: [{ id: "global", label: "Global back" }, { id: "per-screen", label: "Per-screen" }, { id: "none", label: "None" }], default: "per-screen", whyAsked: "Back behavior affects flow", profileKey: "flow.back" },
  { seedId: "F5", tier: "P3", since: "M2", slot: "flow.nav", question: "Is there persistent navigation? Top bar / Bottom bar / Side drawer / None", options: [{ id: "top", label: "Top bar" }, { id: "bottom", label: "Bottom bar" }, { id: "drawer", label: "Side drawer" }, { id: "none", label: "None" }], default: "top", whyAsked: "Persistent nav affects layout", profileKey: "screens.nav" },
  { seedId: "F6", tier: "P3", since: "M2", slot: "flow.main", question: "Should the flow loop? Yes, return to start / No, end at goal", options: [{ id: "loop", label: "Yes, return to start" }, { id: "end", label: "No, end at goal" }], default: "end", whyAsked: "Determines if flow is cyclic", profileKey: "flow.main" },
  { seedId: "F7", tier: "P3", since: "M3", slot: "flow.links", question: "Are there conditional branches? Yes, based on user data / No, linear", options: [{ id: "yes", label: "Yes, based on user data" }, { id: "no", label: "No, linear" }], default: "no", whyAsked: "Conditional branches add complexity", profileKey: "flow.links" },
  { seedId: "S1", tier: "P1", since: "M1", slot: "screens.start", question: "Which screen opens first? (options from your screen list)", options: [{ id: "first", label: "First in list" }, { id: "last", label: "Last in list" }], default: "first", whyAsked: "First screen is the entry point", profileKey: "screens.start" },
  { seedId: "S2", tier: "P2", since: "M1", slot: "screens.list", question: "How many screens? 1-2 / 3-5 / 6+", options: [{ id: "1-2", label: "1-2" }, { id: "3-5", label: "3-5" }, { id: "6+", label: "6+" }], default: "1-2", whyAsked: "Screen count affects navigation", profileKey: "screens.list" },
  { seedId: "S3", tier: "P3", since: "M2", slot: "screens.roles", question: "Different user roles? None / Admin+User / Multiple tiers", options: [{ id: "none", label: "None" }, { id: "admin-user", label: "Admin+User" }, { id: "multi", label: "Multiple tiers" }], default: "none", whyAsked: "Roles affect screen variants", profileKey: "screens.roles" },
  { seedId: "S4", tier: "P3", since: "M1", slot: "screens.list", question: "Which screens exist? (options from your screen list, at most 5)", options: [{ id: "first", label: "First in list" }, { id: "all", label: "All screens" }], default: "first", whyAsked: "First screen is what people see first", profileKey: "screens.list", dynamicOptions: "screens" },
  { seedId: "S5", tier: "P2", since: "M1", slot: "screens.start", question: "Is there a splash or onboarding screen? Yes / No", options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }], default: "no", whyAsked: "Splash screens delay entry", profileKey: "screens.start" },
  { seedId: "S6", tier: "P3", since: "M2", slot: "screens.roles", question: "Role-specific screens? Shared / Per-role / Hybrid", options: [{ id: "shared", label: "Shared" }, { id: "per-role", label: "Per-role" }, { id: "hybrid", label: "Hybrid" }], default: "shared", whyAsked: "Role-specific screens add maintenance", profileKey: "screens.roles" },
  { seedId: "U1", tier: "P1", since: "M1", slot: "users.primary", question: "Who is the primary user? Internal team / Public consumers / Enterprise admins / Mixed", options: [{ id: "internal", label: "Internal team" }, { id: "public", label: "Public consumers" }, { id: "enterprise", label: "Enterprise admins" }, { id: "mixed", label: "Mixed" }], default: "internal", whyAsked: "Audience drives accessibility and tone", profileKey: "users.primary" },
  { seedId: "U2", tier: "P2", since: "M1", slot: "users.access", question: "Access level? Everyone / Signed in / Invite only / Role-based", options: [{ id: "everyone", label: "Everyone" }, { id: "signed", label: "Signed in" }, { id: "invite", label: "Invite only" }, { id: "role", label: "Role-based" }], default: "everyone", whyAsked: "Access affects auth flow", profileKey: "users.access" },
  { seedId: "U3", tier: "P3", since: "M2", slot: "users.intl", question: "Multiple languages? No / Yes, which? (type)", options: [{ id: "no", label: "No" }, { id: "yes", label: "Yes, type them" }], default: "no", whyAsked: "i18n affects content strategy", profileKey: "users.intl" },
  { seedId: "U4", tier: "P3", since: "M2", slot: "users.access", question: "Session persistence? Remember me / Short-lived / Per-session", options: [{ id: "remember", label: "Remember me" }, { id: "short", label: "Short-lived" }, { id: "session", label: "Per-session" }], default: "session", whyAsked: "Persistence affects security", profileKey: "users.access" },
  { seedId: "U5", tier: "P3", since: "M3", slot: "users.intl", question: "RTL support? No / Yes", options: [{ id: "no", label: "No" }, { id: "yes", label: "Yes" }], default: "no", whyAsked: "RTL affects layout direction", profileKey: "users.intl" },
  { seedId: "ST1", tier: "P1", since: "M1", slot: "style.mood", question: "Overall mood? Professional / Playful / Minimal / Bold / Warm", options: [{ id: "professional", label: "Professional" }, { id: "playful", label: "Playful" }, { id: "minimal", label: "Minimal" }, { id: "bold", label: "Bold" }, { id: "warm", label: "Warm" }], default: "professional", whyAsked: "Mood drives the whole look", profileKey: "style.mood" },
  { seedId: "ST2", tier: "P1", since: "M1", slot: "style.palette", question: "Color palette? I have brand colors / Blue trust / Green growth / Purple creative / Orange energy", options: [{ id: "brand", label: "I have brand colors (type them)" }, { id: "blue", label: "Blue trust" }, { id: "green", label: "Green growth" }, { id: "purple", label: "Purple creative" }, { id: "orange", label: "Orange energy" }], default: "blue", whyAsked: "Palette is the visual identity", profileKey: "style.palette" },
  { seedId: "ST3", tier: "P1", since: "M1", slot: "style.theme", question: "Light / Dark / System default?", options: [{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }, { id: "system", label: "System default" }], default: "system", whyAsked: "Theme affects all surfaces", profileKey: "style.theme" },
  { seedId: "ST4", tier: "P2", since: "M1", slot: "style.density", question: "Information density? Compact / Comfortable / Spacious", options: [{ id: "compact", label: "Compact" }, { id: "comfortable", label: "Comfortable" }, { id: "spacious", label: "Spacious" }], default: "comfortable", whyAsked: "Density affects spacing and sizing", profileKey: "style.density" },
  { seedId: "ST5", tier: "P2", since: "M1", slot: "style.corner", question: "Corner shape? Sharp / Slightly rounded / Very rounded / Pill", options: [{ id: "sharp", label: "Sharp" }, { id: "slight", label: "Slightly rounded" }, { id: "round", label: "Very rounded" }, { id: "pill", label: "Pill shaped" }], default: "slight", whyAsked: "Corner shape changes the feel of every button and card", profileKey: "style.corner" },
  { seedId: "ST6", tier: "P2", since: "M1", slot: "style.brand", question: "Brand reference? None / I have brand colors / Like an app I will name / Use design system", options: [{ id: "none", label: "None" }, { id: "colors", label: "I have brand colors (type them)" }, { id: "app", label: "Like an app I will name" }, { id: "system", label: "Use my project's design system" }], default: "none", whyAsked: "Brand rules override the default look", profileKey: "style.brand" },
  { seedId: "ST7", tier: "P2", since: "M1", slot: "style.heading", question: "Heading weight? Light / Medium / Strong", options: [{ id: "light", label: "Light (400)" }, { id: "medium", label: "Medium (500)" }, { id: "strong", label: "Strong (600/700)" }], default: "medium", whyAsked: "Heading weight affects hierarchy", profileKey: "style.heading" },
  { seedId: "ST8", tier: "P3", since: "M2", slot: "style.density", question: "Typography scale? Standard / Large / Small", options: [{ id: "standard", label: "Standard" }, { id: "large", label: "Large" }, { id: "small", label: "Small" }], default: "standard", whyAsked: "Scale affects readability", profileKey: "style.density" },
  { seedId: "C1", tier: "P2", since: "M1", slot: "content.tone", question: "Content tone? Direct / Friendly / Authoritative / Conversational", options: [{ id: "direct", label: "Direct" }, { id: "friendly", label: "Friendly" }, { id: "authoritative", label: "Authoritative" }, { id: "conversational", label: "Conversational" }], default: "direct", whyAsked: "Tone affects all copy", profileKey: "content.tone" },
  { seedId: "C2", tier: "P1", since: "M1", slot: "content.data", question: "Data source? Static / API / Local storage / Mixed", options: [{ id: "static", label: "Static" }, { id: "api", label: "API" }, { id: "local", label: "Local storage" }, { id: "mixed", label: "Mixed" }], default: "static", whyAsked: "Data source affects architecture", profileKey: "content.data" },
  { seedId: "C3", tier: "P2", since: "M1", slot: "content.media", question: "Images or video? None / Stock photos / Custom uploads / Embedded", options: [{ id: "none", label: "None" }, { id: "stock", label: "Stock photos" }, { id: "custom", label: "Custom uploads" }, { id: "embedded", label: "Embedded" }], default: "none", whyAsked: "Media affects storage and layout", profileKey: "content.media" },
  { seedId: "C4", tier: "P3", since: "M2", slot: "content.name", question: "Project name or tagline? I have one / Make one up / No name needed", options: [{ id: "have", label: "I have one (type it)" }, { id: "make", label: "Make one up for me" }, { id: "none", label: "No name needed" }], default: "make", whyAsked: "Name appears in headers and titles", profileKey: "content.name" },
  { seedId: "C5", tier: "P3", since: "M2", slot: "content.legal", question: "Legal text needed? Privacy / Terms / Cookies / None", options: [{ id: "privacy", label: "Privacy" }, { id: "terms", label: "Terms" }, { id: "cookies", label: "Cookies" }, { id: "none", label: "None" }], default: "none", whyAsked: "Legal pages need dedicated screens", profileKey: "content.legal" },
  { seedId: "C6", tier: "P3", since: "M2", slot: "content.tone", question: "Error message style? Technical / Friendly / Minimal", options: [{ id: "technical", label: "Technical" }, { id: "friendly", label: "Friendly" }, { id: "minimal", label: "Minimal" }], default: "friendly", whyAsked: "Error tone affects trust", profileKey: "content.tone" },
  { seedId: "C7", tier: "P3", since: "M3", slot: "content.data", question: "Offline support? No / Read-only / Full sync", options: [{ id: "no", label: "No" }, { id: "readonly", label: "Read-only" }, { id: "full", label: "Full sync" }], default: "no", whyAsked: "Offline adds complexity", profileKey: "content.data" },
  { seedId: "C8", tier: "P3", since: "M3", slot: "content.tone", question: "Microcopy style? Functional / Playful / Minimal", options: [{ id: "functional", label: "Functional" }, { id: "playful", label: "Playful" }, { id: "minimal", label: "Minimal" }], default: "functional", whyAsked: "Microcopy affects perceived quality", profileKey: "content.tone" },
  { seedId: "C9", tier: "P3", since: "M3", slot: "content.legal", question: "Accessibility statement? None / Basic / Detailed", options: [{ id: "none", label: "None" }, { id: "basic", label: "Basic" }, { id: "detailed", label: "Detailed" }], default: "basic", whyAsked: "Legal requirement in some regions", profileKey: "content.legal" },
];

export const DEEP_DIVE_SEEDS: Seed[] = [
  { seedId: "D1", tier: "P2", since: "M1", slot: "deep.formPattern", question: "Form pattern? Single page / Multi-step / Wizard / Inline edit", options: [{ id: "single", label: "Single page" }, { id: "multi", label: "Multi-step" }, { id: "wizard", label: "Wizard" }, { id: "inline", label: "Inline edit" }], default: "single", whyAsked: "Form pattern affects UX", profileKey: null },
  { seedId: "D2", tier: "P2", since: "M1", slot: "deep.errorHandling", question: "Error handling? Inline / Toast / Modal / Page", options: [{ id: "inline", label: "Inline" }, { id: "toast", label: "Toast" }, { id: "modal", label: "Modal" }, { id: "page", label: "Page" }], default: "inline", whyAsked: "Error pattern affects trust", profileKey: null },
  { seedId: "D3", tier: "P3", since: "M2", slot: "deep.loading", question: "Loading pattern? Skeleton / Spinner / Progress bar / None", options: [{ id: "skeleton", label: "Skeleton" }, { id: "spinner", label: "Spinner" }, { id: "progress", label: "Progress bar" }, { id: "none", label: "None" }], default: "skeleton", whyAsked: "Loading affects perceived speed", profileKey: null },
  { seedId: "D4", tier: "P3", since: "M2", slot: "deep.emptyStates", question: "Empty state style? Illustration + text / Text only / Action prompt", options: [{ id: "illustration", label: "Illustration + text" }, { id: "text", label: "Text only" }, { id: "action", label: "Action prompt" }], default: "illustration", whyAsked: "Empty states affect retention", profileKey: null },
  { seedId: "D5", tier: "P2", since: "M1", slot: "deep.buttonStyle", question: "Main button look? Solid / Outlined / Text only", options: [{ id: "solid", label: "Solid color" }, { id: "outlined", label: "Outlined" }, { id: "text", label: "Text only" }], default: "solid", whyAsked: "Button style is the primary action signal", profileKey: "deep.buttonStyle" },
  { seedId: "D6", tier: "P2", since: "M1", slot: "deep.imageShape", question: "Image corners? Square / Rounded / Circle", options: [{ id: "square", label: "Square" }, { id: "rounded", label: "Rounded" }, { id: "circle", label: "Circle" }], default: "rounded", whyAsked: "Image shape reinforces brand", profileKey: "deep.imageShape" },
];

export const CONTROL_SEEDS: Array<{ seedId: string; label: string; when: string; question: string; options: Array<{ id: string; label: string }> }> = [
  { seedId: "CT1", label: "Start interview", when: "At the very beginning", question: "Shall we start the interview for this project?", options: [{ id: "yes", label: "Yes, start now" }, { id: "defer", label: "Ask me later" }] },
  { seedId: "CT2", label: "Over soft cap", when: "Meter exceeds 89% with required topics incomplete", question: "You've answered many questions but some required topics are incomplete. Continue asking?", options: [{ id: "yes", label: "Yes, ask more" }, { id: "no", label: "No, show summary" }] },
  { seedId: "CT3", label: "Ambiguous answer", when: "User reply is unclear", question: "I'm not sure I understood. Did you mean [summary] or [other]?", options: [{ id: "summary", label: "Yes, that's it" }, { id: "other", label: "No, let me rephrase" }] },
  { seedId: "CT4", label: "Profile prefill", when: "Remembered values exist for slots in scope", question: "I have remembered values for some questions. Use them all, change some, or start fresh?", options: [{ id: "all", label: "Use them all" }, { id: "some", label: "Let me change some" }, { id: "fresh", label: "Start fresh" }] },
  { seedId: "CT5", label: "Change summary", when: "User returns from summary with changes", question: "How do you want to change it? Type the change / Ask me again about those lines", options: [{ id: "type", label: "I will type what to change" }, { id: "ask", label: "Ask me again about those lines" }] },
];

export const ALL_SEEDS = [...INTERVIEW_SEEDS, ...DEEP_DIVE_SEEDS];

export function validateBank(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const seed of INTERVIEW_SEEDS) {
    const result = SeedSchema.safeParse(seed);
    if (!result.success) {
      errors.push(`${seed.seedId}: ${result.error.message}`);
    }
  }
  for (const seed of DEEP_DIVE_SEEDS) {
    const result = SeedSchema.safeParse(seed);
    if (!result.success) {
      errors.push(`${seed.seedId}: ${result.error.message}`);
    }
  }
  return { valid: errors.length === 0, errors };
}