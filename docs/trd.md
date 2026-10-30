# trd.md: Intent Technical Requirements

Status: Draft v0.2 | Created: 2026-10-22 | Depends on: prd.md v0.1, design.md v0.1, architecture.md v0.1

This document fixes the exact technical contracts: schemas, formats, algorithms, protocols, limits and file layouts. architecture.md says what the parts are. This document says precisely how they behave. Code samples are normative for shape and behavior, not for syntax details of any library version (see 2.3).

---

## 1. Scope and Conventions

- **M1/M2/M3 tags** show the milestone in which a feature becomes active. Schemas for later milestones are defined now so that M1 files stay forward-compatible, but their validation is off until the tagged milestone.
- **MUST / SHOULD / MAY** follow their usual meaning.
- All numbers are in CSS pixels unless stated. All times are ISO 8601 UTC strings (`2026-10-22T10:15:30.123Z`).
- All text is UTF-8, NFC-normalized on write. LF newlines.
- Core logic never calls `Date.now()`, `Math.random()` or `crypto` directly. It receives `Clock` and `IdGenerator` ports (see 4.5) so tests are deterministic.

## 2. Technology Baseline

### 2.1 Choices

| Area | Decision | Notes |
|------|----------|-------|
| Language | TypeScript, `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` | No `any` outside a documented, linted escape hatch |
| Modules | ESM only | No CommonJS builds in v1 |
| Package manager | pnpm workspaces | Lockfile committed |
| Validation | Zod, at every boundary | Syntax in this doc is schematic; adapt to the installed major version |
| Studio UI | React, Zustand + Immer, Radix primitives, Moveable (M2), perfect-freehand (M2), Vite | Per PRD and design.md 6.3 |
| Unit and integration tests | Vitest | |
| Browser tests and visual diff | Playwright | Pinned browser build in CI |
| Lint and format | ESLint plus a formatter (Prettier or Biome, pick one in M1 step 0) | |
| Import boundaries | `dependency-cruiser` or an equivalent rule set | Fails CI on violations of architecture.md section 3 |
| MCP | Official TypeScript MCP SDK, stdio transport | Verify (2.3) |
| Node | The oldest Node LTS line that is still supported on the day M1 starts and that has every API this doc uses | Enforced through `engines` and `intent-studio doctor`. Verify (2.3) |
| License | MIT | |

### 2.2 Version Policy

1. No dependency is added from memory. Each one is checked against its official docs and recorded in `docs/versions.md` with the verified version and the date (PRD NFR-9).
2. Dependencies are pinned to exact versions in the lockfile. Upgrades are separate commits.
3. Prefer the standard library over a package when the need is small (hashing, atomic writes, lock files).

### 2.3 Verification Log (the agent fills this in M1 step 0, before any code)

| Item | Used for | What to verify | Result (agent fills) |
|------|----------|----------------|----------------------|
| Node LTS | Runtime | Current supported LTS lines, `fs.watch` recursive behavior per OS, `fs.rename` behavior on Windows | |
| MCP specification and TS SDK | `mcp-server` | Current spec revision, stdio transport, tool result format (`structuredContent` support, `isError`), elicitation support (AQ4) | |
| Claude Code and Cursor | Tier 1 | Config file paths, MCP config syntax, rules/skills file format, whether tool results with images render | |
| Cline, Codex, Windsurf, Copilot | Tier 2 | Same as above, best effort | |
| Zod | Schemas | Installed major version, discriminated union and recursive type syntax | |
| React, Vite, Zustand, Immer, Radix, Moveable, perfect-freehand | Studio | Versions and React compatibility | |
| File watcher library | AQ1 | Maintained library, behavior on Windows, macOS, Linux, network drives | |
| Playwright | Visual diff | Version, browser pinning, font availability in CI image | |
| npm name `intent-studio` | OQ1 | Availability (`npm view`). If taken, choose a scoped name and update all docs through a change log entry | |

## 3. Identifiers

### 3.1 Format

`<prefix>_<ULID>`, where ULID is 26 characters of Crockford base32 (`0-9A-HJKMNP-TV-Z`, uppercase). Regex: `^<prefix>_[0-9A-HJKMNP-TV-Z]{26}$`.

| Prefix | Entity |
|--------|--------|
| `o_` | Scene object (including screen roots) |
| `s_` | Screen |
| `c_` | Component definition |
| `p_` | Patch |
| `a_` | Annotation |
| `q_` | Interview question |
| `v_` | Version |
| `k_` | Asset |

### 3.2 Rules

- IDs are generated only by `core` through `IdGenerator.next(prefix)`. The 48-bit time part comes from `Clock`. The random part comes from a CSPRNG in production and from a seeded generator in tests. Within one process, IDs are strictly increasing (monotonic ULID rule).
- IDs are never reused, even after deletion.
- Agents never invent IDs. New objects are added without IDs, and the core returns the mapping `clientRef -> id`.
- IDs are used in file names. Because they match the regex above, they cannot contain path characters. Every ID is validated before it touches a path.
- Human-readable `name` fields are separate. They have no uniqueness requirement.
## 4. Shared Primitives (package `schema`)

### 4.1 Scalars

```ts
Px            = int, 0..10000
Space         = int, 0..1024, MUST be a multiple of 4 (enforced by L-GRID, not by the schema, so the agent gets a lint hint, not a parse failure)
Color         = string matching /^#[0-9a-f]{6}([0-9a-f]{2})?$/   (lowercase canonical; input is lowercased by the normalizer)
TokenRef      = string matching /^\$[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/   e.g. "$color.primary", "$space.2"
SizeValue     = Px | "fill" | "hug"
FontWeight    = 400 | 500 | 600 | 700
Text          = string, NFC, max 2000 chars, control characters (except \n) rejected
```

Colors are hex only (no `rgb()`, `hsl()`, named colors, gradients). This keeps contrast computation exact and removes a CSS-injection surface.

### 4.2 Tokens

```ts
Tokens = {
  color:      Record<name, { light: Color, dark?: Color }>,   // dark defaults to light if absent
  space:      Record<name, Space>,
  radius:     Record<name, Px>,
  fontSize:   Record<name, Px>,
  fontFamily: Record<name, "system" | "mono">,                 // no web fonts in v1 (see 13.5)
  shadow:     Record<name, "none" | "low" | "medium">
}
```

Names match `/^[a-z][a-z0-9-]*$/`. `core` exports `defaultTokens`; a scene's `tokens` extend or override by name. Reference syntax: `$<group>.<name>`.

Default tokens (normative):

| Group | Names and values |
|-------|------------------|
| space | `1`=4, `2`=8, `3`=12, `4`=16, `6`=24, `8`=32, `12`=48 |
| radius | `sm`=4, `md`=8, `lg`=12, `full`=9999 |
| fontSize | `xs`=12, `sm`=14, `md`=16, `lg`=20, `xl`=24, `2xl`=32, `3xl`=40, `4xl`=48 |
| color (light / dark) | `bg` #ffffff / #0b0f19; `surface` #f3f4f6 / #161b26; `text` #111827 / #f3f4f6; `text-muted` #4b5563 / #9ca3af; `primary` #2563eb / #60a5fa; `primary-text` #ffffff / #0b0f19; `border` #6b7280 / #9ca3af; `success` #15803d / #4ade80; `warning` #a16207 / #facc15; `danger` #b91c1c / #f87171 |

A unit test computes every text/background pair that the design intends to be used together (`text` on `bg`, `text` on `surface`, `text-muted` on `bg`, `primary-text` on `primary`, `border` on `bg` at 3:1, and the same in dark) and fails if any is below its required ratio. The hex values above are starting values. The test is the authority.

### 4.3 Style, Layout, Size

```ts
Style = strict {
  background?: Color | TokenRef,
  color?: Color | TokenRef,
  borderColor?: Color | TokenRef,
  borderWidth?: int 0..16,
  radius?: Px | TokenRef,
  opacity?: number 0..1,
  fontSize?: Px | TokenRef,
  fontWeight?: FontWeight,
  fontFamily?: TokenRef | "system" | "mono",
  lineHeight?: number 1..2.5,
  textAlign?: "start" | "center" | "end",
  shadow?: TokenRef | "none" | "low" | "medium"
}

Layout = strict {                      // only on containers
  mode: "stack" | "grid" | "free",
  direction?: "row" | "column",        // stack only, default "column"
  gap?: Space | TokenRef,
  rowGap?: Space | TokenRef,           // grid only
  columns?: int 1..12,                 // grid only
  padding?: Space | TokenRef | { top?, right?, bottom?, left? },
  align?: "start" | "center" | "end" | "stretch",     // cross axis, default "stretch"
  justify?: "start" | "center" | "end" | "between",   // main axis, default "start"
  wrap?: boolean
}

Size     = strict { w?: SizeValue, h?: SizeValue, minW?: Px, maxW?: Px, minH?: Px, maxH?: Px }   // default "hug" for both
Position = strict { x: int, y: int }            // allowed only when the parent layout.mode === "free"
```

Every string value that reaches CSS (colors, token names, enumerations) comes from these closed grammars. There is no free-form CSS string anywhere in the schema.

### 4.4 Responsive Overrides (M2)

Mobile-first. The base values apply to all widths. Overrides apply at and above a breakpoint.

| Key | Min width | Maps to frame |
|-----|-----------|---------------|
| (base) | 0 | Phone 390 |
| `sm` | 640 | Tablet 834 |
| `md` | 1024 | (small desktop) |
| `lg` | 1440 | Desktop 1440 |

```ts
Responsive = strict { sm?: Override, md?: Override, lg?: Override }
Override   = strict { style?: Partial<Style>, layout?: Partial<Layout>, size?: Partial<Size>, position?: Position, visible?: boolean }
```

The breakpoint values come from `config.json` and default to the table above (design.md section 12).

### 4.5 Ports Used by Core

```ts
interface Clock { now(): Date }
interface IdGenerator { next(prefix: IdPrefix): string }
interface Hasher { sha256Hex(bytes: Uint8Array): string }     // Node crypto or WebCrypto
```

## 5. Scene Schema

### 5.1 Top Level

```ts
Scene = strict {
  schemaVersion: 1,
  revision: int >= 1,
  meta: { name: string(1..80), createdAt: ISO, updatedAt: ISO },
  tokens: Tokens (partial overrides allowed),
  components: ComponentDef[],            // M2
  screens: Screen[],                      // at least 1
  assets: Record<AssetId(k_), Asset>
}
Screen = strict { id: s_, name: string(1..60), rootId: o_ (points into the object tree below), start?: boolean, rev: int }
```

Representation on disk: **tree**. A screen's root is the node itself:

```ts
Screen = strict { id: s_, name: string, start?: boolean, rev: int, root: ObjectNode }
```

(`rootId` is not stored. The root node carries the screen's content. Exactly one screen has `start: true`; if none does, the first screen is the start screen.)

### 5.2 Object Node

```ts
ObjectBase = {
  id: o_,
  type: ObjectType,
  name: string(1..60),
  rev: int >= 1,                               // revision at which this node (not its subtree) last changed
  visible?: boolean,                           // default true
  size?: Size,
  position?: Position,
  margin?: Space | TokenRef,                   // outer spacing, all sides
  style?: Style,
  states?: Record<StateName, StateOverride>,
  interactions?: Interaction[],
  responsive?: Responsive,                     // M2
  a11y?: { label?: Text, role?: AriaRole, hidden?: boolean, decorative?: boolean },
  componentRef?: ComponentRef                  // M2
}

StateName = "hover" | "pressed" | "focus" | "disabled" | "loading" | "visited"
          | "filled" | "error" | "checked" | "empty" | "open" | "success" | "submitting" | "content"
StateOverride = strict { style?: Partial<Style>, props?: Partial<TypeProps>, visible?: boolean, text?: Text }

ObjectNode = discriminated union on `type`:
  text       : ObjectBase & { props: { text: Text, as?: "p"|"span"|"h1"|"h2"|"h3"|"h4"|"h5"|"h6" (default "p") } }
  button     : ObjectBase & { props: { label: Text(max 80), variant: "primary"|"secondary"|"ghost"|"danger", disabled?: boolean } }
  image      : ObjectBase & { props: { source: { assetId: k_ } | { placeholder: "neutral" }, alt: Text(max 200) | "", fit?: "cover"|"contain" } }
  input      : ObjectBase & { props: { kind: "text"|"email"|"password"|"number"|"search"|"textarea", label: Text(max 80), placeholder?: Text, value?: Text, required?: boolean, helper?: Text, error?: Text } }
  container  : ObjectBase & { props: { as?: "div"|"section"|"nav"|"header"|"footer"|"main"|"form"|"ul"|"li" }, layout: Layout, children: ObjectNode[] }
```

M2 adds: `checkbox`, `radio`, `switch`, `link`, `list`, `modal`, `icon`, `divider`. They follow the same pattern. Adding a type MUST be done by adding one schema variant, one render function, one linter state-table row and one exporter mapping, with no change to the core machinery.

Limits: maximum tree depth 24, maximum children per container 200, maximum objects per scene 2000 (hard), warning above 500 (see 20).

### 5.3 State Representation (closes design.md flag and DQ4)

- `states[name]` holds an override applied while that state is active.
- **Pseudo-states** (`hover`, `pressed`, `focus`, `disabled`, `visited`, `checked`, `filled`) are driven by the browser through CSS (`:hover`, `:active`, `:focus-visible`, `:disabled`, `:visited`, `:checked`, `:not(:placeholder-shown)`). They need no interaction.
- **Data states** (`loading`, `error`, `empty`, `open`, `success`, `submitting`, `content`) are driven by `data-state` attributes toggled by interactions (`setState`).
- The Inspector state switcher forces any state active in the preview for review.
- Default state for each type is the object's own base style and props.
- Limits of static export are listed in 13.6.

### 5.4 Interactions

```ts
Interaction = strict { event: "click" | "submit" | "change", action: Action }
Action =
  | { type: "navigate", screenId: s_ }            // M1
  | { type: "setState", targetId: o_, state: StateName | "default" }   // M1
  | { type: "toggleState", targetId: o_, state: StateName }           // M2
  | { type: "back" }                                                  // M2
```

Constraints: `screenId` and `targetId` must exist (checked by L-SCHEMA). No timers, no network, no scripting. Prototypes stay declarative data.

### 5.5 Components and Instances (M2)

```ts
ComponentDef = strict { id: c_, name: string, rev: int, root: ObjectNode, exposedProps: Record<propKey, { nodeId: o_, path: JsonPointer }> }
ComponentRef = strict { componentId: c_, overrides?: Record<o_ (node inside the component), Partial<{ props, style, visible }>> }
```

An instance object has `type` of the component root and `componentRef`. The normalizer expands it and assigns derived IDs `"<instanceId>::<nodeId>"` to inner nodes for DOM and feedback mapping. Patches target the instance, never the inner node of a definition, unless the user chooses "Edit component" (then `objectId` is the definition's inner node and the change affects all instances).

## 6. Patch Schema and Operations

### 6.1 Patch File (`.intent/patches/p_<ULID>.json`)

```ts
Patch = strict {
  schemaVersion: 1,
  id: p_,
  objectId: o_,                          // the target object of the patch
  baseRevision: int,                     // scene revision the user saw
  origin: "studio" | "agent",
  kind: "feedback" | "direct",           // feedback: user asks, agent produces ops. direct: ops already applied by the Studio
  status: "draft" | "sent" | "applied" | "rejected" | "conflict",
  ops: Op[],                             // empty for a feedback patch until the agent applies it
  feedback?: { text?: Text(max 2000), chips: Chip[], annotationIds: a_[] },
  createdAt: ISO, sentAt?: ISO, resolvedAt?: ISO,
  resolution?: { appliedRevision: int, touchedIds: o_[] }
             | { errors: ErrorBody[] }
}
Chip = "bigger" | "smaller" | "more-space" | "less-clutter" | "different-color" | "more-premium" | "simpler"
```

### 6.2 Op Shapes

```ts
Op =
  | { op: "set",     targetId?: o_, path: JsonPointer, value: Json }
  | { op: "unset",   targetId?: o_, path: JsonPointer }
  | { op: "add",     parentId: o_, index?: int, node: NodeInput, clientRef?: string(1..40) }
  | { op: "remove",  targetId: o_ }
  | { op: "move",    targetId: o_, newParentId: o_, index?: int }
  | { op: "setState",targetId?: o_, state: StateName, override: StateOverride | null }   // null removes the state
```

- `targetId` defaults to the patch's `objectId`.
- `NodeInput` is an `ObjectNode` without `id` and `rev` (recursively for children). The core assigns IDs and returns `assignedIds: Record<clientRef, o_>`. A node without `clientRef` still gets an ID, listed in `touchedIds`.
- **Path whitelist** for `set` and `unset`. Allowed roots: `/name`, `/visible`, `/size`, `/position`, `/margin`, `/style`, `/layout`, `/props`, `/a11y`, `/interactions`, `/responsive`. Forbidden: `/id`, `/rev`, `/type`, `/children` (use `add`, `remove`, `move`), `/states` (use `setState`), `/componentRef`. Violations return `E_BAD_REQUEST`.
- **Scope rule.** Every `targetId`, `parentId` and `newParentId` MUST lie inside the subtree rooted at the patch's `objectId` (inclusive). A `move` that would take an object out of that subtree is rejected.
- **Result validation.** After applying all ops to an in-memory copy, the whole affected subtree is validated by the schema and the linter (see 7). Ops are atomic: all apply or none.
- **Order.** Ops apply in array order. `index` outside `0..children.length` is clamped. Maximum 200 ops per patch.

### 6.3 The Touched Set and Revision Rules

Definitions, used by every write:

| Op | Objects added to the touched set |
|----|----------------------------------|
| `set`, `unset`, `setState` | the target |
| `add` | the parent (its children list changed) and every new node |
| `remove` | the removed node and its parent |
| `move` | the moved node, the old parent and the new parent |

Acceptance test inside the lock (architecture 9.1): the write is accepted only if, for every **existing** object in the touched set, `object.rev <= baseRevision`. Otherwise `E_CONFLICT` with `details.changedObjectIds`.

On acceptance: `scene.revision += 1`, then every object in the touched set does **not** get its `rev` changed except the touched ones. Ancestors keep their `rev`. Only the touched set gets `rev = scene.revision`. (This is deliberate: editing a leaf does not create a conflict for its siblings or ancestors.)

`scene.meta.updatedAt` is set from `Clock`. Screens have their own `rev`, updated when the screen's name or `start` flag changes (by direct edit only in M2).

### 6.4 Draft, Send, Apply Transitions

| From | Event | To | Who |
|------|-------|----|-----|
| (none) | user adds feedback | `draft` | Studio |
| `draft` | Send to agent | `sent` | Studio |
| `draft` | discard | (file removed) | Studio |
| `sent` | `apply_patch` succeeds | `applied` | agent |
| `sent` | `apply_patch` fails schema or lint | `rejected` (errors stored) | agent call |
| `rejected` | `apply_patch` retried with the same `patchId` | `applied` or `rejected` | agent |
| `sent` | `apply_patch` hits `E_CONFLICT` | `conflict` | agent call |
| `conflict` | user: Keep mine | `draft` (new `baseRevision`) | Studio |
| `conflict` | user: Take agent's | `applied` (the agent's change that won) | Studio |
| any direct edit | applied immediately | `applied`, `kind: "direct"` | Studio |

`E_LOCKED` and `E_BAD_REQUEST` do not change patch status. The agent gets the error and the patch stays `sent`.

**Coalescing direct edits.** A stream of direct edits (drag, nudge, Inspector typing) to the same object within 2 seconds merges into one `direct` patch (ops concatenated and compacted: consecutive `set` ops on the same path keep only the last). Drag produces a single op on release (architecture section 18).

**Retention.** Patches newer than the latest baseline (see 17.2) are never pruned. Older `applied` patches are pruned beyond `maxAppliedPatches` (default 1000) oldest first.

## 7. Linter Specification (package `linter`)

### 7.1 Interfaces

```ts
interface Violation {
  ruleId: string; severity: "error" | "warn" | "info";
  objectId: o_ | null; path?: JsonPointer;
  message: string; fixHint: string; suggested?: Json;
  confidence: "exact" | "estimated";
}
type Rule = (scene: Scene, ctx: LintContext) => Violation[];
LintContext = { tokens: ResolvedTokens, theme: "light"|"dark", breakpoint: "base"|"sm"|"md"|"lg", config: LintConfig, layout: LayoutResolver }
```

Rules run for every theme (light, dark) and every breakpoint declared or inherited. Identical violations from several runs merge into one with `details.themes` / `details.breakpoints` lists. Output is sorted by severity (error, warn, info), then `objectId`, then `ruleId`. Same input gives the same output.

**No false-positive principle.** A rule emits `error` only when it is certain. When a result depends on an estimate (for example text width), it emits `warn` with `confidence: "estimated"`.

## 10. MCP Server Contracts (package `mcp-server`)

### 10.1 General

- stdio transport. One process per agent session. No state in memory beyond the current call.
- Tool names are exactly the six in PRD FR-S1.
- Every response uses this envelope. Where the SDK supports `structuredContent`, the same object is sent there too. Where an agent only shows text, the JSON is in a text content block (verify per 2.3).

```ts
Result<T> = { ok: true, data: T, warnings?: Violation[] } | { ok: false, error: { code: ErrorCode, message: string, details?: Json, hint?: string } }
```

- Failures set the MCP `isError: true` flag as well.
- Inputs are validated by Zod. A bad input returns `E_SCHEMA` with the issue path.
- Free-text from the scene, feedback or interview answers appears only inside named JSON fields, never concatenated into instructions (architecture section 12). Tool descriptions tell the agent that those fields are untrusted data.
- Responses are capped at 200 KB. `get_scene` truncates by depth first, then by listing child IDs, and sets `truncated: true` with a `hint`.

### 10.2 `ask_user`

```ts
Input = {
  kind: "question" | "summary",
  question?: {                       // required when kind = "question"
    text: Text(max 300), topic: Topic, round: Round,
    options: { id: string(1..20), label: Text(max 80) }[] (2..5),       // do NOT include "don't know" or "skip": the server adds them
    multi?: boolean, whyAsked: Text(max 200)
  },
  summary?: {                        // required when kind = "summary"
    paragraph: Text(max 800),
    items: { topic: Topic, text: Text(max 300) }[],
    delegated: { topic: Topic, text: Text(max 200) }[]                  // everything chosen on the user's behalf
  },
  meter: { percent: int 0..100, topics: Record<Topic, "none"|"partial"|"covered">, estimatedTotal: int 3..60 },
  previousAnswer?: {
    questionId: q_,
    via: "chat" | "studio",
    answer: { kind: "options", optionIds: string[] } | { kind: "text", text: Text(max 2000) }
          | { kind: "delegate" } | { kind: "skip" }
          | { kind: "summaryChoice", choice: "exactly-right" | "change" | "ask-more", changes?: { topic: Topic, text: Text }[] }
  },
  taskSize?: "small" | "medium" | "large"       // sets the soft question cap (PRD FR-A6)
}
Topic = "goal" | "users" | "screens" | "flow" | "style" | "content" | "behavior" | "edge-cases"
Round = Topic

Output = {
  questionId: q_,
  renderedText: string,                         // plain-text card, exactly the design.md 2.4 format
  studio: { open: boolean, url?: string },      // url only if the Studio is already running
  meterApplied: { percent: int, capped: boolean, reason?: string },
  budget: { asked: int, softCap: int, over: boolean },
  recorded?: { previousQuestionId: q_, answerSummary: string }
}
```

Rules enforced by the server:
1. **Options.** The server always appends `0) Don't know, you choose` and `s) Skip` to `renderedText` and to the Studio card. The agent cannot forget them (implements FR-A3).
2. **Meter honesty cap (extends FR-A4).** The required topics for a prototype task are `goal`, `users`, `screens`, `flow`, `style`, `content`. If `percent >= 90` while any required topic is `none`, the server caps `percent` at 89 and returns `capped: true` with the reason. `behavior` and `edge-cases` do not block 90.
3. **Delegation.** `delegate` answers are stored under `delegated[]` in `interview/state.json` with the question text and the default the agent then states in the next call's `summary.delegated`. The summary screen must list all of them or the server returns `E_BAD_REQUEST`.
4. **Soft cap.** `softCap` = 12 / 25 / 40 for small / medium / large (default medium if not given, upper end of the PRD ranges). Above the cap the response sets `over: true` and a `hint` "Offer to stop and show the summary". It is not an error.

5. **Summary.** `kind: "summary"` renders the "Here is what I understood" block (design.md 2.3) as text with options `1) Exactly right 2) Change something 3) Ask more questions`. The choice returns in the next call's `previousAnswer.summaryChoice`. On `exactly-right` the server saves a `interview-approved` version if a scene exists, and marks the interview `approved` in its state.
6. **Studio side.** If the Studio is open, the question appears in the Interview tab, and an answer given there is stored in `interview/state.json` and returned by `get_feedback` as `interviewAnswers`. If the user answers in chat instead, the agent passes it as `previousAnswer` with `via: "chat"`. Whichever arrives first wins. The second is ignored with a note.

`interview/state.json`:

```ts
InterviewState = strict {
  schemaVersion: 1, status: "active" | "approved" | "abandoned",
  taskSize: "small"|"medium"|"large", startedAt: ISO,
  questions: { id: q_, kind, text, topic, round, options, askedAt, answer?: Answer & { answeredAt: ISO, via } }[],
  delegated: { questionId: q_, topic, text }[],
  meter: { percent, topics, estimatedTotal, history: { at: ISO, percent }[] },
  pendingStudioAnswers: { questionId: q_, answer: Answer, answeredAt: ISO, consumed: boolean }[]
}
```

## 10.3 `get_scene`

```ts
Input  = { objectIds?: o_[] (max 50), depth?: int 0..24 (default 3 when objectIds given, else 2), includeLocks?: boolean (default true) }
Output = { revision: int, nodes: ObjectNode[] (each truncated at depth; deeper children replaced by { id, type, name, childCount }),
           screens: { id, name, start, rootId }[], tokens: ResolvedTokenNames, locked: o_[] (effective: includes descendants of locked containers), truncated: boolean }
```

With no `objectIds`, returns the screen list plus screen roots at the given depth. Always returns `revision`, which the agent must pass back as `baseRevision`.

### 10.4 `get_feedback`

```ts
Input  = { since?: ISO (filter by sentAt), objectId?: o_, includeRejected?: boolean (default false), includeImageData?: boolean (default false) }
Output = {
  revision: int,
  patches: { id, objectId, baseRevision, feedback: { text?, chips, annotations: AnnotationSummary[] }, sentAt, stale: boolean }[],   // status "sent" (plus "rejected" if asked), oldest first
  interviewAnswers: { questionId, answer }[],        // unconsumed Studio-side answers, marked consumed by this call
  locked: o_[]
}
```

`stale` is true if the target object's `rev` is above the patch's `baseRevision`. The agent should call `get_scene` for that object before acting. Reading is otherwise side-effect free, except that `interviewAnswers` are marked `consumed` (the one allowed write, done inside the lock, so a crash between read and use costs at most one re-ask).

### 10.5 `apply_patch`

```ts
Input  = { patchId?: p_, objectId: o_, baseRevision: int, ops: Op[] (1..200), note?: Text(max 300) }
Output = { status: "applied", revision: int, touchedIds: o_[], assignedIds: Record<string, o_>, warnings: Violation[] }
Errors = E_SCHEMA | E_LINT (details.violations) | E_LOCKED (details.lockedIds) | E_CONFLICT (details.changedObjectIds) | E_BUSY | E_NOT_FOUND | E_BAD_REQUEST | E_IO
```

- Without `patchId`, the server creates an `origin: "agent"`, `kind: "direct"` patch so history stays complete.
- With `patchId`, the patch must be `sent` or `rejected` and its `objectId` must equal the input's `objectId`.
- `warnings` carries non-blocking violations (warn and info) so the agent can improve them in a follow-up.

### 10.6 `validate`

```ts
Input  = { ops?: { objectId: o_, baseRevision?: int, ops: Op[] }, scene?: Scene, rules?: string[] }
Output = { violations: Violation[], summary: { errors: int, warnings: int, infos: int }, wouldApply: boolean }
```

With `ops`, applies them to an in-memory copy of the current scene and lints (steps 5 to 11 of section 8, no writes, no lock held for longer than the read). With `scene`, validates a full candidate (used when the agent creates the first scene). With neither, validates the current file. `scene` input over 1 MB returns `E_BAD_REQUEST`.

## 10.7 First Scene (closes a gap in architecture)

The architecture's `apply_patch` always has a target object, but a new project has no scene. Decision: `apply_patch` accepts the reserved target `objectId: "scene"` (a virtual root). Allowed ops for it are `add` with `parentId: "scene"` and a `screen` node (`{ name, start?, root: NodeInput }`), `remove` of a screen, and `set` on `/meta/name` and `/tokens/...`. `baseRevision` is `0` for an empty project. This is the only place a virtual target exists. Locks do not apply to `"scene"` itself, but they apply to every real object inside.

### 10.8 `open_studio`

```ts
Input  = { userRequested: true, quote: Text(max 200) }       // quote: the user's words that asked for the Studio
Output = { url: string, started: boolean, port: int, expiresAfterIdleMinutes: int }
```

- `userRequested` must be the literal `true` and `quote` must be non-empty, or `E_BAD_REQUEST`. This does not prove the user asked (an agent could lie), but it forces a visible, logged claim. The tool description and rules.md say when it is legitimate.
- If `runtime.json` exists and the pid answers a health check, return its URL (`started: false`).
- Otherwise start the Studio server (spawn a detached child), wait up to 5 s for `runtime.json`, return the URL. The URL carries the token in the fragment (11.2). Opening a browser is done by the CLI only when started by `intent-studio open`. From an agent, the tool returns the URL and the agent shows it. No automatic browser launch from the MCP server.

## 11. Studio Server and HTTP API (package `server`)

### 11.1 Process Rules

- Binds `127.0.0.1` on a random free port (or `--port`). Writes `.intent/runtime.json`: `{ pid, port, token, startedAt, version }` with mode `0o600`.
- Idle timeout from `config.idleTimeoutMinutes` (default 30). Idle means no HTTP requests and no open SSE connection. Shutdown removes `runtime.json`.
- Serves the built SPA as static files with strong cache for hashed assets and `no-store` for `index.html`.
- Response headers on every response: `Content-Security-Policy` for the shell (`default-src 'self'; frame-src 'self' blob:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Cache-Control: no-store` on `/api`.

### 11.2 Session and Auth (refines architecture 12)

1. `open_studio` and `intent-studio open` give the URL `http://127.0.0.1:<port>/#t=<token>`.
2. On load the SPA reads the fragment, calls `POST /api/session { token }`, then `history.replaceState` to remove the fragment.
3. The server compares the token in constant time and sets a cookie `intent_session=<random 32 bytes hex>; HttpOnly; SameSite=Strict; Path=/api; Max-Age=<idle timeout>`.
4. Every `/api` request must have: a valid session cookie, `Host` exactly `127.0.0.1:<port>` or `localhost:<port>`, and for non-GET requests an `Origin` header equal to `http://<that host>`. Anything else returns 403 with no detail.
5. No CORS headers are sent. Preflight requests are refused.

### 11.3 Routes

All JSON bodies are validated with Zod and limited to 2 MB (1 MB for annotation JSON, 1 MB for PNG upload endpoint with `Content-Type: image/png`).

| Method and path | Purpose | Body or query | Result |
|-----------------|---------|---------------|--------|
| `POST /api/session` | Exchange token for cookie | `{ token }` | 204 |
| `GET /api/scene` | Full scene (the Studio needs it all) | | `{ scene, locked, revision }` |
| `POST /api/ops` | Direct edit | `{ objectId, baseRevision, ops }` | `applyOps` result |
| `GET /api/patches` | List patches | `?status=` | `Patch[]` |
| `POST /api/patches` | Create draft feedback patch | `{ objectId, baseRevision, feedback }` | `Patch` |
| `PATCH /api/patches/:id` | Edit a draft | `{ feedback }` | `Patch` |
| `DELETE /api/patches/:id` | Discard a draft | | 204 |
| `POST /api/patches/send` | Send drafts | `{ ids: p_[] }` (all drafts if omitted) | `Patch[]` (and a `before-send` version is saved) |
| `POST /api/patches/:id/resolve` | Resolve a conflict | `{ choice: "keep-mine" | "take-agents" }` | `Patch` |
| `POST /api/annotations` | Save annotation | `Annotation` (without id) | `Annotation` |
| `PUT /api/annotations/:id/image` | Save the PNG | raw PNG | 204 |
| `GET /api/locks` and `PUT /api/locks/:id` | Read, set or clear a lock | `{ locked: boolean }` | `{ locked: o_[] }` |
| `GET /api/versions`, `POST /api/versions`, `GET /api/versions/:id`, `POST /api/versions/:id/restore` | Versions | per 9.6 | |
| `GET /api/interview` and `POST /api/interview/answer` | Interview state and Studio-side answers | `{ questionId, answer }` | `InterviewState` |
| `GET /api/lint` | Lint the current scene (same `linter` code) | `?theme=&breakpoint=` | `Violation[]` |
| `GET /api/export/:target` | Export (`html`, later `react`) | `?theme=` | `{ files: FileMap }` and, for `html`, `Content-Disposition` download |
| `GET /api/config`, `PUT /api/config` | Settings | `Config` | `Config` |
| `GET /api/events` | SSE stream | | events |

Pagination: `GET /api/patches` returns at most 200, newest first, with a `nextCursor`.

### 11.4 SSE Events

`event: <name>` with a JSON `data`. Names: `scene.changed { revision, objectIds }`, `patch.changed { id, status }`, `interview.changed {}`, `locks.changed {}`, `versions.changed {}`, `server.notice { level, text }`. A `ping` comment every 20 s. `id:` is a counter, and the server replays the last 100 events when a client reconnects with `Last-Event-ID`. If the gap is larger, it sends `resync` and the client refetches.

## 12. Preview Iframe Protocol (refines architecture 10.3)

### 12.1 Construction

- The Studio creates `<iframe sandbox="allow-scripts" srcdoc="...">`. No `allow-same-origin`, no `allow-forms`, no `allow-popups`.
- The srcdoc HTML contains the preview runtime (a prebuilt, inlined bundle) and a CSP meta tag: `default-src 'none'; script-src 'nonce-<n>'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`. The nonce is generated per load.
- The runtime contains no scene data. Scene data arrives by message.

### 12.2 Messages

```ts
StudioToPreview =
  | { t: "init", channel: string }                           // first message, sent after the iframe signals "ready"
  | { t: "render", channel, model: RenderModel, breakpoint, theme }
  | { t: "select", channel, ids: string[] }
  | { t: "mode", channel, mode: "edit" | "preview" }
  | { t: "forceState", channel, id: string, state: StateName | null }
PreviewToStudio =
  | { t: "ready" }
  | { t: "hover", channel, id: string | null }
  | { t: "click", channel, id: string }                     // in edit mode: selection request
  | { t: "bounds", channel, rects: Record<string, {x,y,w,h}> }   // measured boxes for selected and hovered ids
  | { t: "navigated", channel, screenId: string }
  | { t: "error", channel, message: string }
```

Validation: both sides validate every message with Zod. **Origin check change:** a sandboxed iframe without `allow-same-origin` has the opaque origin `"null"`, so `event.origin` carries no information. Therefore the Studio accepts a message only if `event.source === iframe.contentWindow` **and** `msg.channel` equals the random channel ID it issued with `init`. The iframe accepts messages only if `event.source === window.parent` and the channel matches. The channel ID is 128 random bits per iframe load. Messages are sent with target origin `"*"` (the only possible value for an opaque origin) and contain no secrets.

### 12.3 Edit Overlays

Selection boxes, hover outlines, guides, pins and pencil layers are drawn by the Studio in a sibling layer above the iframe, positioned from the `bounds` messages. They are never part of the RenderModel, so they cannot reach any exporter.

## 13. Rendering and Export (package `engine`)

### 13.1 Normalization

`normalize(scene: Scene, locks?: ignored): RenderModel` is a pure function. No clock, no randomness, no environment.

Steps, in order: resolve tokens to CSS custom properties; expand component instances (M2); resolve inherited text styles; map each object to a `RenderNode`; compute base, per-breakpoint and per-state style maps; attach accessibility attributes; collect interactions; sort everything deterministically.

### 13.2 RenderModel

```ts
RenderModel = {
  formatVersion: 1,
  title: string,
  startScreenId: string,
  vars: { light: Record<cssVar, string>, dark: Record<cssVar, string> },   // e.g. "--color-primary": "#2563eb"
  breakpoints: { sm: int, md: int, lg: int },
  screens: { id: string, name: string, root: RenderNode }[]
}
RenderNode = {
  id: string,                       // object id (or "<instance>::<node>")
  tag: "div"|"section"|"nav"|"header"|"footer"|"main"|"form"|"ul"|"li"|"p"|"span"|"h1"|..."h6"|"button"|"input"|"textarea"|"label"|"img"|"svg",
  attrs: Record<string, string>,    // allowlisted attribute names only (see 13.4)
  text?: string,                    // plain text, escaped by renderers
  style: StyleMap,                  // base
  bp: { sm?: StyleMap, md?: StyleMap, lg?: StyleMap },
  states: Record<StateName, StyleMap>,
  interactions: { event, action }[],
  children: RenderNode[]
}
StyleMap = Record<cssProperty (kebab-case, from a closed allowlist), cssValue (string from a closed grammar)>
```

Layout mapping (normative): `stack` becomes `display:flex; flex-direction; gap`; `grid` becomes `display:grid; grid-template-columns: repeat(n, minmax(0, 1fr))`; `free` becomes parent `position:relative` and children `position:absolute; left; top`. `fill` becomes `flex:1 1 0; min-width:0` along the main axis and `align-self:stretch` across it (or `width:100%`). `hug` becomes `width:auto` / `height:auto`. Box sizing is `border-box` globally in the generated CSS.

CSS values are produced only by mapping functions from the closed schema grammars. A final `assertSafeCssValue` check (regex allowlist: digits, letters, `#`, `.`, `%`, `-`, `,`, `(`, `)`, spaces, `var(--...)`, `calc(...)` limited to digits and operators) throws on anything else. This is defense in depth.

### 13.3 Exporter Interface

```ts
type FileMap = Record<string /* relative path, forward slashes, no "..", no leading "/" */, string /* UTF-8 text */>
interface Exporter {
  id: "html" | "react" | string
  export(model: RenderModel, options: ExportOptions): FileMap
}
ExportOptions = { title?: string, theme?: "light" | "dark" | "auto" (default "auto"), includeDataIds?: boolean (default false), header?: boolean (default true: "Generated by intent-studio vX, do not edit by hand") }
```

Exporters are pure and take no environment input. The header contains the package version but no date.

### 13.4 HtmlExporter (M1)

Output: exactly one file, `index.html`.

```
<!doctype html>
<html lang="en">           (lang from config, default "en")
<head> meta charset, viewport, title, CSP meta (default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:), <style> </head>
<body> <main id="app"> one <section class="screen" id="s-<id>" hidden?> per screen </main> <script> navigation + states </script> </body>
```

- **CSS:** CSS custom properties on `:root` for light values, `@media (prefers-color-scheme: dark)` overrides, and `:root[data-theme="light"|"dark"]` overrides (when `theme` is not `auto`, the exporter writes only that theme's values to `:root` and omits the media query). A small reset. One class per node, named `o-<id lowercased without prefix>`. Rules sorted in tree order. Breakpoints as `@media (min-width: Npx)` blocks after the base rules, in order `sm`, `md`, `lg`. State rules: pseudo-states via pseudo-classes, data states via `[data-state~="name"]`.
- **Fonts:** system font stack (`system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`) and a monospace stack. No web fonts in v1 (13.5).
- **Allowed attributes:** `id`, `class`, `role`, `aria-label`, `aria-hidden`, `aria-describedby`, `aria-live`, `alt`, `src` (data URI only), `type`, `name`, `placeholder`, `value`, `required`, `disabled`, `for`, `href` (only `#s-<id>` links), `data-state`, `data-go`, `data-set`, `data-oid` (only if `includeDataIds`), `tabindex`.
- **Escaping:** text content escapes `& < > " '`. Attribute values escape the same. `data:` image URLs are validated against `^data:image/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$`. SVG content is never inlined from user data (SVG data URIs are used only inside ``, where scripts do not run). Everything else is dropped.

- **Script:** one inline script of at most about 1.5 KB (minified by hand-written code, not a minifier, to keep determinism). It (a) shows the screen named in `location.hash` or the start screen, (b) handles `[data-go]` clicks (navigate), (c) handles `[data-set="id:state"]` clicks and `submit` events (`setState`), by setting `data-state` on the target element, and (d) moves focus to the new screen's heading or container on navigation, and respects `prefers-reduced-motion` (no transitions are generated in M1).
- Navigation without script: `href="#s-<id>"` links plus a `:target` CSS fallback so basic navigation works with JavaScript disabled. States need the script.
- Semantic output: `button` for buttons, `label` + `input` pairs with `for`/`id`, headings per `as`, `main`, `nav`, lists for `ul`/`li`.
- **Size limit:** 1 MB per exported file by default. Over the limit, the exporter still writes and reports `warnings` through the `export` route (not an error).

### 13.5 Fonts, Images, Assets

- v1 uses system and monospace stacks only. Design Profile fonts (M3) are referenced by name with the system stack as fallback. Custom web fonts are not loaded (no external requests). Embedding a font as a data URI is out of scope for v1.
- Images: `assets[k_]` holds `{ mime, dataBase64, width, height, bytes }`. Per asset limit 256 KB, total assets limit 5 MB (configurable). Allowed MIME types: png, jpeg, webp, gif. SVG assets are allowed only as `` data URIs and are size-checked (max 100 KB) and sanitized on import by a strict allowlist (no `script`, no `foreignObject`, no event attributes, no external references). If the sanitizer is not available, SVG is rejected.
- `placeholder: "neutral"` renders an inline neutral rectangle (CSS background from `$color.surface` plus a small centered `svg` icon as data URI generated deterministically by the engine).

### 13.6 What Static HTML Cannot Express (closes DQ4)

| State or feature | In export |
|------------------|-----------|
| hover, pressed, focus, disabled, checked, filled, visited | Expressed with CSS pseudo-classes. `visited` is limited by browser privacy rules (only color-related properties change) |
| loading | Static style plus a CSS-only indicator (no timers). Shown when `data-state="loading"` is set by an interaction |
| error, empty, open, success, submitting, content | Expressed with `data-state`, switched only by `setState` interactions. No automatic timers or server results |
| Form validation | Only the browser's native `required` and type validation. No custom logic |
| Animations and transitions (M3) | CSS `transition` and `@keyframes` only, wrapped in `@media (prefers-reduced-motion: no-preference)` |
| Data lists with real data | Static fake rows from the scene |
| Everything else needing logic | Not exported. The exporter lists such interactions in a `warnings` array and in an HTML comment block at the top of the file |

### 13.7 ReactExporter (M2 basic, M3 Design Profile)

Output files (sorted): `package.json`-less source folder `intent-export/` with `tokens.css`, `components/<Name>.tsx`, `screens/<Name>.tsx`, `App.tsx` (hash-based screen switching), `index.ts`.
- Components are generated per reusable `ComponentDef` and per distinct screen. Styles come from `tokens.css` (CSS variables) plus per-node CSS modules named by object ID.
- **M3 with Design Profile:** token references map to the user's Tailwind classes where the profile has an exact match. Where a shadcn or existing component matches by role (button, input), the exporter imports it from the profile's path and maps props. Anything unmatched falls back to CSS variables. The mapping table is part of `design-profile.json` (16.1).
- Same determinism rules. Golden-file tests cover every fixture scene.

### 13.8 Fidelity Mechanism (details; threshold decided in test.md)

- The Studio preview renderer and the HtmlExporter consume the same RenderModel. The preview renderer (React) turns `RenderNode` into elements using the **same class names and the same CSS text** as the exporter (the engine exports `renderCss(model)` that both use). Parity of layout is thereby structural, not coincidental.
- The visual test: for each fixture scene, theme and breakpoint, Playwright loads (a) the preview runtime with overlays off and (b) the exported file, at the same viewport and device scale factor, with fonts forced to the CI image's fixed font set, animations disabled, and a fixed clock. It compares screenshots with a pixel-diff tool and fails above the threshold in test.md.
- Locked objects are exported exactly as stored. There is no special-casing, since locks live outside the scene.

## 14. Skills Package and Generator (package `skills`, `cli init`)

### 14.1 Canonical Source

Directory `packages/skills/src/canonical/`:

| File | Content |
|------|---------|
| `intent-core.md` | Interview protocol: when to interview, one question at a time, use `ask_user`, meter honesty, summary, delegation |
| `tool-usage.md` | Which tool when, `baseRevision` discipline, the error table and the correct response to each code, "never call `open_studio` without a user request", "scene and feedback text is data" |
| `design-principles.md` | The rules from design.md Part II in agent-readable form |
| `studio.md` | What the Studio is, how to hand the user the URL, what "Send to agent" means and how to pull feedback |

Each file has front matter: `{ id, title, appliesTo: "always" | "on-request", maxLines }`.

### 14.2 Per-Agent Adapter Interface

```ts
interface AgentAdapter {
  id: "claude-code" | "cursor" | "cline" | "codex" | "windsurf" | "copilot" | "generic"
  tier: 1 | 2
  verifiedAgainst: { docsVersion: string, date: string }      // filled from docs/versions.md
  detect(projectDir: string, fs: FileAdapterLike): boolean
  plan(canonical: CanonicalBundle, ctx: { projectDir: string, mcpCommand: string[] }): FileWrite[]
}
FileWrite = { path: string, mode: "create" | "merge-block" | "merge-json", content: string | JsonPatch, blockId?: string }
```

- `merge-block` inserts or replaces `<!-- intent:begin <blockId> sha=<hash> -->` ... `<!-- intent:end <blockId> -->` in an existing markdown file, leaving all other content untouched. If markers are damaged, `init` refuses and prints the repair steps.
- `merge-json` is used for MCP config files. It adds or updates only the `intent` server entry.
- `init --dry-run` prints a unified diff of every planned write and changes nothing.
- Every generated file records the generator version and the source hash. The drift test regenerates all files from the canonical source and compares.

### 14.3 CLI

| Command | Behavior |
|---------|----------|
| `intent-studio init [--agents a,b] [--dry-run] [--yes]` | Creates `.intent/` with `config.json` and `.gitignore`, runs adapters for detected agents (or the ones given), prints what changed and how to start |
| `intent-studio open [--port n] [--no-browser]` | Starts (or reuses) the Studio server and opens the browser. Explicit user command only |
| `intent-studio mcp` | Starts the MCP server on stdio. Intended to be launched by agents |
| `intent-studio export <html\|react> [--out dir] [--theme t]` | Writes the export to disk without the Studio |
| `intent-studio doctor` | Checks Node version, `.intent/` writability, atomic rename and lock behavior on this filesystem, port binding, generated-file drift, and agent config presence. Prints actionable fixes |
| `intent-studio --version` / `--help` | |

Exit codes: `0` success, `1` generic failure, `2` bad usage, `3` environment problem (`doctor`), `4` locked or busy.

The generated `.intent/.gitignore` ignores: `patches/`, `annotations/`, `interview/`, `runtime.json`, `state.json`, `tmp/`, `logs/`, `metrics.json`. It does not ignore `scene.json`, `locks.json`, `versions/`, `config.json`, `profile.json`, `design-profile.json`.

## 15. Configuration (`.intent/config.json`)

```ts
Config = strict {
  schemaVersion: 1,
  idleTimeoutMinutes: int 5..480 (default 30),
  lang: string (default "en"),
  breakpoints: { sm: int, md: int, lg: int } (defaults 640, 1024, 1440),
  grid: { spacing: 4, layout: 8 },
  touchMinPx: int (default 44), touchGapPx: int (default 8),
  lint: { ruleset?, enabled?, disabled?, severityOverrides? },
  limits: { maxObjects: 2000, warnObjects: 500, maxSceneBytes: 5242880, warnSceneBytes: 1048576, maxAssetBytes: 262144, maxTotalAssetBytes: 5242880, maxAppliedPatches: 1000, maxAutoVersions: 50 },
  annotations: { includeImageForPencil: true, includeImageForPins: false },
  agents: { enabled?: string[] }
}
```

Unknown keys are rejected (so typos are caught). Limits closing AQ5: warn at 500 objects or 1 MB, refuse writes above 2000 objects or 5 MB with `E_BAD_REQUEST` and a clear message.

## 16. Scanner and Design Profile (M3)

### 16.1 `design-profile.json`

```ts
DesignProfile = strict {
  schemaVersion: 1, generatedAt: ISO,
  sources: { kind: "tailwind"|"shadcn"|"css-variables"|"token-json"|"storybook"|"components", file: string, confidence: "high"|"medium"|"low" }[],
  tokens: Partial<Tokens>,
  grid?: { spacing: int },
  components: { role: "button"|"input"|"text"|"container"|..., importPath: string, exportName: string, propMap: Record<string,string>, confidence }[],
  tailwind?: { colorMap: Record<hex, className>, spacingMap: Record<px, className>, radiusMap: Record<px, className> }
}
```

### 16.2 Scanner Rules

- Reads only an allowlist: `tailwind.config.{js,cjs,mjs,ts}`, `components.json`, `**/tokens.json` and `**/*.tokens.json` (W3C design tokens format), `:root` blocks in CSS files under `src/`, `app/`, `styles/`, `.storybook/main.*`, and `package.json` dependency names. Respects `.gitignore`, skips `node_modules` and build output, skips files above 512 KB.
- **Never executes user code.** Config files like `tailwind.config.js` are parsed statically (a JavaScript parser, extracting literal objects). If a value cannot be statically resolved, it is skipped and listed under `unresolved` with the reason. Running the user's config would execute arbitrary code, which the architecture forbids.
- Output is deterministic and sorted. Unknown formats are ignored, not guessed.
- Accessibility rules are never relaxed by the profile (design.md section 13). If a profile token pair fails contrast, the linter still reports it, and the Studio shows "Your design system has a contrast problem: <pair>".

## 17. Intent Profile and Metrics (M3)

### 17.1 `profile.json` (learned preferences)

```ts
IntentProfile = strict { schemaVersion: 1, entries: { id: string, key: string, value: Json, text: Text(max 200), source: { kind: "answer"|"edit"|"rejection", refs: string[] }, count: int, confidence: number 0..1, createdAt: ISO, updatedAt: ISO }[] }
```

- An entry is created only after **2 consistent signals** or **1 explicit statement** ("always", "never", "I prefer"). Keys come from a closed list (`style.density`, `style.corner`, `style.palette`, `content.tone`, `layout.navigation`, `dislikes`, ...). Free-form keys are rejected.
- Agents read the profile via `get_scene` metadata (`profileSummary`) and `ask_user` (`preFilled` in its output, M3). Pre-filled answers are shown as "Remembered from before" and must be confirmed or changed in one tap.
- The user can view, edit and delete entries in the Studio settings. Entries never contain scene text, only normalized choices.

### 17.2 Acceptance-Rate Metric (PRD section 9, precise definition)

- **Baseline:** the scene at the `interview-approved` version, or if none, the first scene the agent wrote (`first-render` marker stored as a version at the first successful `apply_patch` to `"scene"`).
- **Total:** objects (not screens) existing in the final exported scene.
- **Changed:** an object in the final scene whose ID existed in the baseline and was touched by any `applied` patch after the baseline (direct or feedback), plus any object created after the baseline (`add`). Removed baseline objects count toward `removed` and appear in the denominator of a second figure.
- `acceptanceRate = unchanged / baselineObjectsStillPresent`, and also reported: `addedAfterBaseline`, `removedAfterBaseline`.
- Locking an object is **not** a change. Moving or resizing is a change. Undo that restores an identical state before it is applied is not recorded.
- Computed on demand from patch files and the baseline version (not stored). Reported in the Studio and in `export` output metadata (`export` summary, not in the exported code).
- It is a local measure. It never leaves the machine.

## 18. Logging, Diagnostics, Errors

### 18.1 Logs

JSON lines in `.intent/logs/intent-<n>.log`, rotated at 1 MB, 3 files kept. Fields: `ts`, `level`, `event`, `ids`, `ms`, `code`. Never scene text, feedback text, annotation text or file contents. `LOG_LEVEL` through `INTENT_LOG` environment variable (`error`, `warn`, `info`, `debug`).

### 18.2 Error Codes (extends architecture 13)

`ErrorBody = { code, message, details?, hint? }` with codes `E_SCHEMA`, `E_LINT`, `E_LOCKED`, `E_CONFLICT`, `E_BUSY`, `E_NOT_FOUND`, `E_BAD_REQUEST`, `E_IO`, `E_VERSION`, plus HTTP-only `E_AUTH` (403) and `E_LIMIT` (413 or limit refusal, mapped to `E_BAD_REQUEST` in MCP with `details.limit`).

HTTP status mapping: `E_SCHEMA` 400, `E_BAD_REQUEST` 400, `E_AUTH` 403, `E_NOT_FOUND` 404, `E_CONFLICT` 409, `E_LOCKED` 423, `E_LIMIT` 413, `E_BUSY` 503 with `Retry-After`, `E_LINT` 422, `E_IO` 500, `E_VERSION` 409.

### 18.3 Message Style

Plain language, no stack traces, one actionable sentence in `hint`. Example: `E_LINT`: message "3 design rules failed", `details.violations` list, hint "Apply each suggested value and call apply_patch again".

## 19. Schema Versioning and Migration (closes OQ4, C8)

- Every persisted file has an integer `schemaVersion` starting at 1.
- `packages/schema/src/migrations/<kind>.ts` exports `migrations: Record<fromVersion, (doc) => doc>` for each file kind (`scene`, `patch`, `locks`, `version`, `interview`, `state`, `config`, `profile`, `design-profile`, `annotation`). Each function is pure and takes the document of version N and returns version N+1.
- `readDocument(kind, raw)`: if `schemaVersion` is greater than the current, throw `E_VERSION` ("This file was written by a newer intent-studio. Update the package"). If lower, run migrations in sequence in memory and return the current shape. The file is rewritten in the new version on the next accepted write, never on read alone.
- Each migration has a fixture test (old file, expected new file) and a round-trip test (migrate, validate, serialize).
- Breaking schema changes require a changelog entry in this document and a new migration. Version bumps of the package follow semantic versioning, and any new `schemaVersion` is a minor bump at least.

## 20. Limits Summary

| Limit | Value | On exceed |
|-------|-------|-----------|
| Objects per scene | warn 500, hard 2000 | warn / `E_BAD_REQUEST` |
| Scene file | warn 1 MB, hard 5 MB | warn / `E_BAD_REQUEST` |
| Tree depth | 24 | `E_SCHEMA` |
| Children per container | 200 | `E_SCHEMA` |
| Ops per patch | 200 | `E_BAD_REQUEST` |
| Text field | 2000 chars (feedback 2000, annotation text 1000) | `E_SCHEMA` |
| HTTP body | 2 MB (annotation JSON 1 MB, PNG 1 MB) | 413 |
| PNG annotation | 512 KB, longest edge 1280 | omitted, vectors kept |
| Strokes per annotation | 50 strokes, 500 points each | simplified, then `E_SCHEMA` |
| MCP response | 200 KB | truncated with a flag |
| Asset | 256 KB each, 5 MB total | `E_BAD_REQUEST` |
| Applied patches kept | 1000 older than baseline | oldest pruned |
| Auto versions | 50 | oldest auto pruned |
| Lock acquire | about 2 s, 12 attempts | `E_BUSY` |
| Stale lock | 10 s or dead pid | broken |
| Studio idle timeout | 30 min default | server stops |
| Export HTML file | 1 MB warn | warning only |

## 21. Performance Requirements (measurable)

On a mid-range laptop, with a 500-object scene:
- `core.applyOps` for one object (steps 1 to 14): under 100 ms at the 95th percentile.
- Studio drag at 60 fps (no dropped frames beyond 5% during a 3 s drag). Commit one op on release.
- `get_scene` for a subtree of 50 nodes: under 50 ms.
- Full-scene `normalize`: under 50 ms. HtmlExporter: under 100 ms.
- Studio cold start from `intent-studio open` to first render: under 3 s.
These become benchmark tests (not blocking in M1, blocking in M2).

## 22. Security Requirements (testable restatement)

1. Studio server never listens on a non-loopback address.
2. Requests without a valid session cookie and exact `Host` return 403.
3. Non-GET requests with a foreign or missing `Origin` return 403.
4. Any ID used in a path matches the ID regex first.
5. `FileAdapter` rejects any resolved path outside `<project>/.intent/` (after resolving symlinks with `realpath` of the parent directory).
6. Scene strings never reach `innerHTML`. `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` and `eval` are banned by lint everywhere except a single audited file (the preview runtime's static template) with an inline justification.
7. The preview iframe cannot make network requests (CSP) and cannot read Studio storage or cookies (opaque origin).
8. Exports contain no external URLs except `href="#s-..."` and `data:` images.
9. The Scanner never executes user code.
10. No telemetry, no outbound network requests from any package in v1. A CI test greps for network APIs (`fetch`, `http`, `https`, `net`, `dgram`) outside the explicit allowlist (the Studio server's `http` module).

## 23. Requirement Traceability

| Requirement | Sections |
|-------------|----------|
| FR-A1 to FR-A8 | 10.2, 14.1, 17.1 |
| FR-B1 | 10.8, 11.1, 14.3 |
| FR-B2 | 5.3, 5.4, 12, 13 |
| FR-B3 | 6, 9.6, 9.7, 11.3 |
| FR-B4, FR-B5 | 6, 8, 10.5 |
| FR-B6 | 13.3 to 13.7 |
| FR-B7 | 5.5 |
| FR-S1 | 10 |
| FR-S2 | 7 |
| FR-S3 | 16 |
| FR-S4 | 14 |
| NFR-1, NFR-2 | 11.2, 12, 22 |
| NFR-3 | 9.5, 13 |
| NFR-5 | 21 |
| NFR-6 | 4.5, 13 |
| NFR-7 | 8, 9 |
| NFR-8 | 15, 16 |
| NFR-9 | 2.2, 2.3 |
| design.md section 9 and 10 | 7 |
| design.md DQ1 | 9.7 |
| design.md DQ4 | 13.6 |
| architecture AQ1 | 9.4 |
| architecture AQ2 | 9.2 |
| architecture AQ4 | 2.3, 10.1 (verify, optional use) |
| architecture AQ5 | 15, 20 |
| PRD OQ2 | 2.1 |
| PRD OQ4 | 19 |

## 24. Conflicts, Amendments and Flags

Nothing in earlier documents has been changed silently. Each item needs a dated change-log entry in the affected document.

| ID | Conflict or amendment | Proposed resolution |
|----|----------------------|---------------------|
| T1 | architecture 10.3 says the iframe protocol checks `event.origin`. A sandbox without `allow-same-origin` has the opaque origin `"null"`, so that check is meaningless | Use `event.source` identity plus a random channel ID (12.2). Amend architecture 10.3 |
| T2 | architecture section 8 lists five op kinds. A property cannot be removed with `set` | Add the sixth op `unset` (6.2). Amend architecture section 8 |
| T3 | architecture section 6 does not list `.intent/state.json`, which is needed to detect external edits across stateless processes (9.3) | Add `state.json` (gitignored) to the layout. Amend architecture sections 6 and 9.3 |
| T4 | architecture section 8 diagram shows `rejected --(agent retries)--> sent`. In this design the agent retries directly from `rejected` (6.4) and `get_feedback` shows only `sent` by default | Amend the diagram. No behavior change for users |
| T5 | PRD FR-A4 lets the agent stop at 90 percent. The meter is self-reported | Server caps at 89 while a required topic is uncovered (10.2 rule 2). Add to PRD FR-A4 |
| T6 | PRD FR-A3 requires "Don't know" and "Skip" on every question. Agents could omit them | Server appends them (10.2 rule 1). No PRD change, record in decisions log |
| T7 | architecture 12 says the token goes in the URL fragment and a cookie. The exchange is unspecified | Specified in 11.2 (POST then HttpOnly cookie, fragment removed). Refinement |
| T8 | design.md section 5 has three frames, section 12 has three breakpoints (640, 1024, 1440). The tablet frame (834) falls between the first two | Mobile-first mapping in 4.4 (base, sm, md, lg). Refinement of design.md section 12 |
| T9 | architecture 8 says direct edits are saved as applied patches. A drag could create thousands of files | Coalescing and retention (6.4). Refinement |
| T10 | architecture `apply_patch` assumes an existing target object, but a new project has no scene | Virtual target `"scene"` (10.7). Amend architecture section 10.1 |
| T11 | PRD NG5 and design.md allow image placeholders. Images with real content need assets | Assets limited to data URIs with caps (13.5). Add to PRD limits |
| T12 | architecture 11 says HtmlExporter uses string templating. The preview must match it exactly | The preview and exporter share `renderCss(model)` and class naming (13.8). Refinement, strengthens D5 |

## 25. Open Questions (to resolve in later documents)

- TQ1. Exact visual-diff pixel threshold, fixed font set in CI and which browsers are compared (test.md).
- TQ2. Which Tier 1 agent behaviors to verify for image results in `get_feedback` (test.md, M2).
- TQ3. Whether to ship a Windows CI runner from M1 or M2 (plan.md). Atomic rename and lock behavior differ there, so M1 is recommended.
- TQ4. SVG sanitizer choice for assets (verify libraries, trd amendment if needed).
- TQ5. Interaction model for `modal` and `menu` in M2: whether `open` is a data state or a separate overlay layer (decide in M2 planning).

## 26. Flags for Later Documents

- **rules.md:** the error-code table with the correct agent response per code, `baseRevision` discipline, `open_studio` rules (userRequested plus quote), untrusted-data rule, no direct edits to `.intent/*.json` by hand, delegated-defaults rule.
- **context.md:** which `.intent/` files and which tool calls an agent uses per task, including `get_scene` depth guidance.
- **memory.md:** record T1 to T12 once approved, and the Verification Log results.
- **plan.md:** M1 step 0 is the Verification Log (2.3). Then order: `schema`, `core` with ports, `linter` M1 rules, `engine` normalize + HtmlExporter, `adapters-node`, `mcp-server`, `server`, `studio`, `skills`, `cli`, demo.
- **test.md:** fixtures (one failing and one passing scene per rule), concurrency tests (two processes), conflict tests, lock bypass attempts including container moves, path traversal, DNS rebinding and Origin tests, iframe sandbox escape attempts, golden export tests, visual-diff test, migration tests, determinism test (export twice, compare bytes), import-boundary test, no-network grep test, token contrast unit test.
- **loop.md:** repeated `E_LINT` or `E_CONFLICT` on the same object three times means stop and report.
- **review.md:** checklist items from sections 8, 12, 13.2 (CSS value allowlist) and 22.

## 27. Change Log

- 2026-10-22: v0.1
- 2026-10-30: v0.2 — Reconciliation Pass (Step R) applied. Owner accepted all recommendations. Dated change-log entry added per MR-03. created from prd.md v0.1, design.md v0.1, architecture.md v0.1. Introduces amendments T1 to T12 for review.

