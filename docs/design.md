# design.md: Intent Design Specification

Status: Draft v0.2 | Created: 2026-10-22 | Depends on: prd.md v0.1

This document has two parts.
- **Part I** defines the UX and visual design of the Intent tools themselves (the interview UI and the Studio).
- **Part II** defines the design rules that every generated prototype must follow. The linter enforces these rules.

Numeric values here are defaults. Anything marked **[configurable]** can be overridden by the Design Profile (M3).

---

# PART I: Product Design (Studio and Interview UX)

## 1. Design Principles

1. **Show, don't describe.** Every question and every result is shown visually where possible.
2. **Choose, don't type.** Tapping an option is always easier than writing. Typing is always allowed but never required.
3. **The user is always in control.** Nothing is sent, applied, or exported without a visible user action. "Don't know, you choose" and "Skip" exist on every question.
4. **One object at a time.** Feedback, patches and locks work per object. The user never has to reason about the whole design to change one thing.
5. **Honest status.** The interface never claims certainty it does not have. The Understanding Meter is labeled an estimate. Patch status is always visible.
6. **Quiet chrome, loud canvas.** The Studio UI is neutral and compact so the prototype is the visual focus.
7. **Keyboard and screen-reader usable.** Accessibility is a baseline, not a polish item.
8. **Reversible by default.** Undo, redo, versions and locks make experimenting safe.

## 2. Module A: Interview UX

### 2.1 Question card
Each question is one card with:
- Question text (one sentence, plain language, no jargon).
- 2-5 option buttons. Options are mutually exclusive unless the card says "Select all that apply".
- A free-text field labeled "Or describe it in your own words".
- Two fixed secondary actions: **Don't know, you choose** and **Skip**.
- A small "Why am I being asked this?" link that shows one sentence of reasoning.
- Progress context: current round name (Goal, Users, Screens, Flow, Style, Content, Behavior, Edge cases) and question number.

Rules:
- One question per card. Never stack questions.
- If the agent cannot render cards, the same content appears as numbered plain text (see 2.4).
- "Don't know, you choose" records a **default decision**, shown later in the preview as "Chosen by me (agent)" so the user can review it.

### 2.2 Understanding Meter
- Display: a horizontal bar, 0-100%, with the label **"Estimated understanding"** and a tooltip: "The agent's own estimate. Always check the preview."
- Below the bar, a row of topic chips (Goal, Users, Screens, Flow, Style, Content, Behavior) each marked: not covered / partly / covered. Status is shown by icon and text, never color alone.
- At 90% or higher the agent may stop asking. It must still show the preview.
- The meter can go down if the user's answer reveals the agent misunderstood something.

### 2.3 "Here is what I understood" preview
A summary screen with:
1. A one-paragraph plain-language summary.
2. A structured list: goal, users, screens, key flows, style, content notes.
3. A section **"Decided by me (agent)"** listing every default the user delegated.
4. Three buttons, always in this order: **Exactly right**, **Change something**, **Ask more questions**.

"Change something" lets the user pick any line and edit it. "Ask more questions" returns to the interview, focused on the weakest topic chips.

### 2.4 Plain-text fallback (agents without card support)
Format used in chat:

```
Question 7 of about 15 | Understanding: ~62% (estimate) | Round: Style
Which look fits best?
  1) Minimal and calm
  2) Bold and colorful
  3) Corporate and clean
  4) Playful
  0) Don't know, you choose
  s) Skip
Reply with a number, or describe it in your own words.
```

The Studio side panel (Interview tab) can show the same card as a real UI when the Studio is open. The Studio never auto-opens for this.


## 3. Module B: Studio Layout

### 3.1 Shell (desktop, 1280px wide or more)

```
+--------------------------------------------------------------------------+
| Top bar: project | screen switcher | device frame | theme | version | Send |
+---------+-------------------------------------------------+--------------+
| Left    |                                                 | Right panel  |
| panel   |                 Canvas                          | tabs:        |
| Screens |        (prototype frame(s), tools)              | Inspector    |
| Layers  |                                                 | Feedback     |
|         |                                                 | Interview    |
+---------+-------------------------------------------------+--------------+
| Bottom tray: Patch queue (status of every pending/sent patch)            |
+--------------------------------------------------------------------------+
```

- Left panel: **Screens** list (thumbnails) and **Layers** tree (the accessible alternative to canvas selection).
- Right panel tabs: **Inspector** (properties of the selected object), **Feedback** (text feedback and pencil notes for the selected object), **Interview** (question cards and the Understanding Meter when active).
- Bottom tray: patch queue, collapsed by default to a single line showing counts (for example "3 draft, 1 sent, 2 applied").
- Panels are resizable and collapsible. Layout is remembered in IndexedDB (UI state).

### 3.2 Smaller screens
- Below 1024px: the left panel and right panel become slide-over drawers. Canvas takes full width.
- Below 640px: the Studio shows a read-and-comment mode (view the prototype, add feedback). Full editing requires a larger screen. This is stated in the UI, not hidden.

### 3.3 Modes
- **Edit mode (default):** clicks select objects. Prototype interactions are paused.
- **Preview mode:** clicks run the prototype (navigation, buttons, forms). Editing handles are hidden. Toggle with `Space+P` or the top bar button.
- The current mode is always visible in the top bar. The canvas shows a thin colored outline in Preview mode (with a text label, not color alone).

## 4. Tools and Interactions

| Tool | Key | Behavior | Milestone |
|------|-----|----------|-----------|
| Select | V | Click to select, shift-click to add, drag to move, handles to resize | M1 select; M2 drag/resize |
| Hand | H | Pan canvas. Scroll to pan, Ctrl/Cmd+scroll to zoom | M1 |
| Comment | C | Click an object or a canvas point to place a pin and write feedback | M2 (M1 uses the Feedback tab) |
| Pencil | P | Draw freehand annotations over an object or screen | M2 |
| Lock | L | Lock or unlock the selected object | M2 |

### 4.1 Selection
- Click selects the deepest object under the cursor. Double-click enters a container. Escape steps out.
- Selected object: 2px outline in the Studio accent color, with a name label above it.
- Hover: 1px outline.
- Multi-select shows a combined bounding box. Per-object feedback still attaches to each object individually.

### 4.2 Move and resize (M2)
- Snap to the 4px grid by default. Hold Alt to disable snapping.
- Smart guides appear when edges or centers align with siblings.
- Arrow keys move by 4px. Shift+Arrow moves by 8px.
- Every move or resize creates a patch `op`, never a silent edit.

### 4.3 Feedback on an object
1. User selects an object.
2. In the Feedback tab: a text field ("What should change?"), quick-feedback chips (**Bigger**, **Smaller**, **More space**, **Less clutter**, **Different color**, **More premium**, **Simpler**), and an optional pencil note.
3. **Add to queue** creates a draft patch for that object only.
4. The user reviews drafts in the bottom tray, then presses **Send to agent**.

### 4.4 Pencil layer (M2)
- Pencil strokes are **annotations**, not scene objects. They are never exported as part of the prototype.
- Strokes attach to a screen or an object. They are saved with the feedback as vector path data plus an optional cropped PNG, so vision-capable agents can see them. Whether PNG is included is configurable (flagged for architecture.md).
- Controls: stroke color (4 presets), thickness (3 sizes), eraser, clear.
- Pencil is for *telling the agent something visually* ("move this here", circling a problem). Direct changes to the scene use drag, resize and the Inspector.

### 4.5 Comment pins (M2)
- A pin is a numbered marker with a text thread. Pins are annotations stored with feedback, not exported.
- Pins show status: open, sent, resolved.

### 4.6 Lock (M2)
- Locked object: lock icon in the Layers tree and a small padlock on the canvas label. No resize handles. Inspector fields are read-only with the message "Locked. Unlock to edit."
- The user can still comment on a locked object, but the agent is told it must not modify it.
- Locking a container locks all its children (shown as inherited lock).


### 4.7 Undo, redo, versions, compare
- Undo/redo (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z): per-session stack in IndexedDB.
- **Named versions** are saved from the top bar ("Save version") and also automatically at milestones: after interview approval and after each applied patch batch.
- **Compare** (M2): split view, side by side or slider overlay. Changed objects get a diff badge and the list of changes is shown in text.
- Restoring a version creates a new revision. History is never rewritten.

### 4.8 Patch lifecycle and status
Every patch has exactly one status, shown by icon and text:

| Status | Meaning |
|--------|---------|
| Draft | Created by the user, not yet sent |
| Sent | Sent to the agent, awaiting a response |
| Applied | The agent applied it successfully |
| Rejected | The linter or schema rejected the agent's change. The error is shown |
| Conflict | The scene changed under this patch (stale revision) |

### 4.9 Conflict handling
When a write is rejected because the revision is stale, show a non-blocking banner:
"The agent changed this object while you were editing."
Actions: **Keep mine**, **Take agent's**, **Compare**. Nothing is overwritten until the user chooses.

### 4.10 Send to agent
- The button shows the count of drafts ("Send 3 changes"). It is disabled when there are none.
- After sending, the Studio shows "Waiting for the agent. Ask your agent to check for feedback" with a **Copy prompt** button (the exact sentence to paste into the agent).
- **Watch mode** (optional toggle): the MCP server notifies the agent session where the agent supports it. Otherwise the copy-prompt flow is the fallback.

### 4.11 Keyboard shortcuts (defaults)

| Action | Shortcut |
|--------|----------|
| Select / Hand / Comment / Pencil | V / H / C / P |
| Toggle Edit and Preview | Space+P |
| Lock / unlock | L |
| Undo / redo | Ctrl/Cmd+Z / Shift+Ctrl/Cmd+Z |
| Delete object | Delete |
| Duplicate | Ctrl/Cmd+D |
| Zoom in / out / fit | Ctrl/Cmd + / - / 0 |
| Save version | Ctrl/Cmd+S |
| Command palette | Ctrl/Cmd+K |

All shortcuts are listed in a help dialog (`?`).

## 5. Device Frames and Theme

- **Frames:** Phone (390x844), Tablet (834x1194), Desktop (1440x900). Custom size allowed. Switching frames re-renders the same scene responsively (M2).
- **Studio theme** (light/dark/system) is independent of the **prototype theme** (light/dark toggle for the prototype only).
- Frames are visual aids. They are never part of the exported code.

## 6. Studio Visual Language

The Studio's own UI uses a small, consistent token set. It does **not** use the user's Design Profile.

### 6.1 Tokens

| Token group | Values |
|-------------|--------|
| Spacing | 4px base: 4, 8, 12, 16, 24, 32, 48 |
| Radius | 4, 8, 12 |
| Type scale | 12, 14, 16, 20, 24 (UI), system font stack with mono for code |
| Line height | 1.4 for UI text, 1.5 for body text |
| Elevation | none, low (menus), medium (dialogs) |
| Motion | 120ms (hover), 200ms (panels), 320ms (dialogs). Ease-out for entering, ease-in for leaving |
| Icon size | 16, 20, 24 |

### 6.2 Color roles (semantic, defined as CSS variables, light and dark values)
`surface`, `surface-raised`, `border`, `text`, `text-muted`, `accent`, `accent-text`, `success`, `warning`, `danger`, `selection`, `focus-ring`.
- Text on surface: contrast 4.5:1 or higher. UI boundaries and icons: 3:1 or higher.
- Status is never conveyed by color alone (always icon plus text).

### 6.3 UI component library (resolves PRD OQ5)
- **Decision:** headless accessible primitives (Radix UI or equivalent) plus the Studio's own CSS variables. No heavy styled UI kit.
- **Why:** accessible behavior for dialogs, menus, tabs and tooltips for free, full control over a compact tool-like look, small bundle, and no styling conflicts with the prototype preview.
- **Rule:** verify the current Radix version and its React compatibility from official docs before pinning, and record the version and date in docs/.

### 6.4 Component states
Every Studio UI component defines: default, hover, pressed, focus-visible, disabled, and where relevant loading and error. Focus ring: 2px, offset 2px, contrast 3:1 or higher against its surroundings.


## 7. Studio's Own Empty, Loading and Error States

| Situation | Message and action |
|-----------|--------------------|
| No scene yet | "Nothing to show yet. Ask your agent to start the interview." Button: Copy starter prompt |
| Agent not connected | "No agent has connected to the MCP server yet." Steps to connect, link to README |
| Loading scene | Skeleton frame, not a spinner alone |
| Scene fails schema validation | Show the first 3 errors in plain words, with "Copy errors for agent" |
| Linter violations | Panel listing rule, object, and fix hint. Click an item to select the object |
| Stale revision | Conflict banner (4.9) |
| Disk write failed | "Could not save. Your changes are kept in this tab." Retry button |
| Locked object edit attempt | Inline message "Locked. Unlock to edit." |

Microcopy: short, calm, plain language, active voice, no blame ("Could not save", not "You failed to save"). No emoji in system messages.

## 8. Accessibility (Studio chrome)

- Full keyboard operation: every tool and panel reachable without a mouse.
- The Layers tree is the accessible equivalent of canvas selection. Selecting there selects on canvas and vice versa.
- Visible focus indicators everywhere. Logical focus order: top bar, left panel, canvas, right panel, bottom tray.
- ARIA roles and labels on all custom controls. Live region announces patch status changes ("Patch for Button 'Buy' applied").
- Respect `prefers-reduced-motion` (no non-essential animation) and `prefers-color-scheme`.
- Minimum target size 44px for touch contexts (mobile read-and-comment mode), 24px minimum for dense desktop controls.

---

# PART II: Prototype Design Rules (linter-enforced)

These rules apply to every Scene the agent produces. Each rule has an ID, a severity, and a fix hint returned to the agent.

## 9. Linter Rules

| ID | Rule | Default | Severity | Milestone |
|----|------|---------|----------|-----------|
| L-SCHEMA | Scene validates against the Zod schema. IDs unique and stable | n/a | error | M1 |
| L-GRID | Spacing, padding, margin, gap are multiples of 4. Layout positions and sizes of containers prefer multiples of 8 | 4px / 8px **[configurable]** | error (4px), warn (8px) | M1 |
| L-CONTRAST | Normal text 4.5:1. Large text (24px+, or 18.66px+ bold) 3:1. UI components and icons 3:1 | WCAG 2.x AA | error | M1 |
| L-TOUCH | Interactive objects are at least 44x44 px, with at least 8px between neighboring targets | 44px **[configurable]** | error | M1 |
| L-TYPE | Font sizes come from the type scale, no more than 3 font weights per screen | 12, 14, 16, 20, 24, 32, 40, 48 **[configurable]** | warn | M2 |
| L-TOKEN | Colors, radii and spacing reference named tokens, not raw values. Raw values allowed only for locked, user-supplied assets | token-only | warn | M2 |
| L-STATES | Required states exist for each interactive component (table in 10) | see 10 | error | M2 |
| L-ALIGN | Siblings in a stack share the same alignment edge. No off-by-small-pixel offsets (tolerance 0px on grid) | 0px | warn | M2 |
| L-HIER | One primary action per container. Heading levels do not skip. Clear size/weight difference between heading and body | see 11 | warn | M2 |
| L-A11Y | Images have alt text. Inputs have labels. Focus order follows visual order. Buttons have accessible names | WCAG 2.x AA | error | M2 |
| L-CONTENT | No placeholder text like "Lorem ipsum" or "Text here". Fake data must look realistic | n/a | warn | M2 |
| L-LOCK | A patch targeting a locked object is rejected | n/a | error | M1 (enforced by MCP server) |

Rules for the linter's output:
- Each violation returns: `ruleId`, `severity`, `objectId`, `message`, `fixHint`, and (where possible) a suggested value.
- Errors block "applied" status. Warnings are shown but do not block.
- In M1, only L-SCHEMA, L-GRID (4px), L-CONTRAST, L-TOUCH and L-LOCK are active, so the agent's first output is decent without overwhelming it.


## 10. Required Component States (L-STATES)

| Component | Required states |
|-----------|-----------------|
| Button | default, hover, pressed, focus, disabled, loading |
| Link | default, hover, visited, focus |
| Input / textarea | default, focus, filled, error, disabled |
| Checkbox / radio / switch | unchecked, checked, focus, disabled |
| List / feed | populated, empty, loading, error |
| Form | idle, submitting, success, error |
| Screen (data-driven) | content, empty, loading, error |
| Modal / menu | closed, open |

Each state must be reachable in the Studio (state switcher in the Inspector) and in the exported HTML where it can be expressed.

## 11. Hierarchy, Layout and Composition Defaults

- **Hierarchy:** one primary action per container. Secondary actions are visually quieter. At most one display-size heading per screen.
- **Layout:** use containers with a consistent spacing scale. Prefer stacks and grids over free positioning. Free positioning is allowed but flagged `info` unless the user chose it by dragging.
- **Spacing rhythm:** related items 8-12px apart, groups 16-24px apart, sections 32-48px apart.
- **Line length:** body text at most about 75 characters wide on desktop.
- **Line height:** 1.4-1.6 for body text. 1.1-1.3 for headings.
- **Color:** one primary color plus neutrals plus semantic colors (success, warning, danger). Maximum 1 accent per screen unless the Design Profile says otherwise.
- **Icons:** one icon set per project. Icons paired with a text label unless universally understood.
- **Content:** realistic fake data (names, prices, dates, photos replaced by neutral image placeholders). No lorem ipsum. Fake data must not contain real people's personal information.
- **Motion in prototypes (M3):** durations 120-320ms, ease-out for entering and ease-in for leaving, and respect `prefers-reduced-motion`. Motion must clarify, never decorate.

## 12. Responsive Rules (M2)

- Breakpoints: 640, 1024, 1440 **[configurable]**.
- Layouts are fluid by default. A phone frame must never need horizontal scrolling for primary content.
- Containers declare how they change per breakpoint (stack, wrap, hide, or resize). The agent must specify behavior for phone, tablet and desktop, or inherit the documented default.

## 13. Design Profile and the User's Own Design System (M3)

- The Scanner reads tailwind.config, components.json (shadcn), CSS variables, token JSON and Storybook, and produces a Design Profile (colors, fonts, spacing scale, radii, components).
- When a Design Profile exists: its tokens replace the defaults in sections 9-11. Where the profile conflicts with a rule (for example a 5px spacing unit), the profile wins for the grid, but accessibility rules (contrast, touch target) are **never** relaxed.
- The Studio shows a badge: "Using your design system: Tailwind and shadcn" or "Using default design tokens".
- No profile detected: defaults apply and the Studio says so.
- Reusable components (FR-B7) map to the user's components where a match is found.

## 14. Design Acceptance Criteria

A design is acceptable per milestone when:
- **M1:** the interview works in plain-text and Studio-panel form. The Studio renders a scene, lets the user select an object, write feedback and Send to agent. Linter reports M1 rules with fix hints. Keyboard-only users can complete the feedback flow.
- **M2:** all tools in section 4 work with keyboard equivalents. Conflict, empty, loading and error states from section 7 exist. A 3-screen prototype passes all M2 linter rules. Axe (or equivalent) reports no critical issues in the Studio chrome.
- **M3:** Design Profile badge and token mapping work. Animations respect reduced motion. The acceptance-rate metric is visible in the Studio.

## 15. Open Questions (to resolve in later docs)

- DQ1. Pencil annotations: send cropped PNG by default, or only vector paths? (decide in architecture.md and trd.md)
- DQ2. Exact accent color and typeface for the Studio (decide during M1 implementation, record in this file).
- DQ3. Should the Studio chrome be localized (for example Urdu or Hindi, with RTL support)? (decide in plan.md)
- DQ4. Component states that cannot be expressed in static HTML export (decide in trd.md).

## 16. Flags for Later Documents

- **architecture.md:** annotation storage format (paths and optional PNG), patch status lifecycle, state switcher needing a `state` field in the schema.
- **trd.md:** exact linter algorithms (contrast calculation, grid check), type scale and token schema, state representation in Scene JSON.
- **rules.md:** "never use color alone for status", "accessibility rules are never relaxed by a Design Profile".
- **test.md:** axe checks on Studio chrome, keyboard-only flow test, linter rule fixtures (one failing and one passing scene per rule).
- **plan.md:** tool rollout per milestone from section 4.

## 17. Change Log

- 2026-10-22: v0.1
- 2026-10-30: v0.2 — Reconciliation Pass (Step R) applied. Owner accepted all recommendations. Dated change-log entry added per MR-03. created. Resolves PRD OQ5 (headless primitives plus own tokens).
