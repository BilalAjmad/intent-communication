# PRD: Intent (working name)

Status: Draft v0.2 | Created: 2026-10-22 | Owner: Project owner | License: MIT

## 1. Problem

Humans often know what they want but cannot express it in words. They write a short prompt, the AI guesses, and the output matches roughly 70% of the intent. The remaining 30% costs many rounds of "no, not like that", which wastes time and tokens and erodes trust.

## 2. Vision

An open-source repo that closes the intent gap in two steps:
1. **Understand before building.** The agent interviews the user at micro level until it truly understands.
2. **Edit visually, not verbally.** The user opens a full, editable prototype studio and changes things directly instead of describing them.

Target: raise intent match from about 70% (after interview) to 97-99% (after studio).

## 3. Goals and Non-Goals

### Goals
- G1. Deep Interview that works in any MCP-capable coding agent (Module A).
- G2. Command-only, Figma-like Prototype Studio rendering a real clickable prototype from a Scene JSON (Module B).
- G3. No API key and no runtime LLM calls inside the repo. The user's own coding agent is the brain.
- G4. Per-object patches: only what changed is sent back to the agent.
- G5. Deterministic code export that matches what the user approved.
- G6. Use the user's existing design system where detected.
- G7. Install and run in under 5 minutes on a clean machine.

### Non-Goals (v1)
- NG1. No hosted service, accounts, cloud sync, or telemetry by default.
- NG2. No code-to-scene import. Export is one-way.
- NG3. No real-time multi-user collaboration.
- NG4. No native desktop shell (Electron/Tauri). The architecture must allow one later.
- NG5. No image or illustration generation. This is a UI prototype tool.
- NG6. No backend or real data logic in prototypes. Fake data only.

## 4. Users

- **P1: Solo builder / vibe-coder.** Uses Claude Code or Cursor, describes ideas loosely, wants the AI to get it right sooner.
- **P2: Developer with an existing design system.** Has Tailwind/shadcn/tokens in the repo, wants prototypes that already look like their product.
- **P3: Designer or PM working with an agent.** Prefers pointing and drawing over writing prompts.

## 5. Product Overview

One monorepo, two modules.

### Module A: Intent Core (always active)
"Always active" means its rules load in every agent session via the rules files (AGENTS.md, CLAUDE.md, .cursor/rules, SKILL.md). It is not a background process.

Requirements:
- FR-A1. On every user request, the agent runs a Deep Interview before building.
- FR-A2. Questions are adaptive and asked one at a time. Each answer can change the next question.
- FR-A3. Every question offers options plus "Don't know, you choose" and "Skip".
- FR-A4. A visible Understanding Meter (0-100%). It is the agent's own heuristic estimate, not a measured truth, and the UI must label it as an estimate. The agent may stop asking at 90% or higher.
- FR-A5. Before building, the agent shows "Here is what I understood". The user picks: Exactly right / Change something / Ask more.
- FR-A6. Question budget by task size: small 8-12, medium 15-25, large 30-40. Micro questions (spacing, shadow, font weight) are asked only for parts the user marks important. Smart defaults cover the rest.
- FR-A7. Plain-text fallback: where an agent cannot render tap options, the question appears in the Studio side panel or as numbered text options in chat.
- FR-A8. The agent learns from user corrections and stores preferences in memory.md, so later interviews get shorter (full behavior in M3).

### Module B: Prototype Studio (command-only)
- FR-B1. Opens only on an explicit user request (`npx intent-studio open` or the MCP tool `open_studio`). It never auto-starts. `/studio` is a convenience alias where the agent supports it.
- FR-B2. Renders the Scene JSON as a real, code-backed, clickable prototype: multi-screen, navigation, states (hover, pressed, error, empty, loading), responsive frames (phone, tablet, desktop), light/dark.
- FR-B3. Direct editing: select, drag, resize, per-object feedback, pencil/draw layer, comment pins, lock button, undo/redo, named versions, version compare.
- FR-B4. "Send to agent" sends only the changed object's patch: `{objectId, baseRevision, ops, feedback}`.
- FR-B5. Locked objects are never modified by the agent. The MCP server rejects patches that target a locked object.
- FR-B6. Export to HTML and React (see section 7).
- FR-B7. Reusable components: change a component once and every instance updates.

### Shared
- FR-S1. Local MCP server (stdio) exposes: `ask_user`, `get_scene`, `apply_patch`, `get_feedback`, `validate`, `open_studio`.
- FR-S2. Local deterministic linter (no AI): 4/8px grid, type scale, color tokens, WCAG contrast, 44px touch targets, required states, alignment and hierarchy. Violations return to the agent as structured errors so it self-corrects.
- FR-S3. Design Scanner detects tailwind.config, components.json (shadcn), CSS variables, design-token JSON, and Storybook, and builds a Design Profile. Prototypes use it by default (M3).
- FR-S4. `npx intent-studio init` generates all per-agent files from one canonical source.

## 6. Non-Functional Requirements

- NFR-1. **Privacy:** local-first, no cloud, no telemetry by default, no secrets in the repo.
- NFR-2. **Security:** the preview runs in a sandboxed iframe. AI-generated code never executes outside the sandbox. Scene text is escaped on render and export.
- NFR-3. **Determinism:** the same scene always exports byte-identical output.
- NFR-4. **Accessibility:** the Studio UI and exported output are accessible by default.
- NFR-5. **Performance:** studio interaction (drag, resize) stays smooth on a scene of 500 objects. A per-object patch round trip should never require sending the full scene.
- NFR-6. **Portability:** engine, schema and studio contain no Node or Electron imports. All environment access goes through adapters.
- NFR-7. **Reliability:** writes are atomic. Concurrent edits are detected, never silently overwritten.
- NFR-8. **Maintainability:** strict TypeScript, Zod validation at all boundaries, one canonical source for rules.
- NFR-9. **Verification of versions:** every library, protocol and agent config format is checked against its latest official docs before use, and the verified version and date are recorded in docs/.

## 7. Decisions Log

| ID | Question | Decision | Why |
|----|----------|----------|-----|
| D1 | Studio runtime | Browser-first SPA (Vite + React) served by a local Node server via `npx`. Core stays platform-agnostic. Access goes through `StorageAdapter`, `FileAdapter`, `BridgeAdapter`. | Same effort as browser-only, avoids Electron packaging risk, and keeps a native shell possible later. |
| D2 | Persistence | Filesystem is the single source of truth: `.intent/scene.json`, `.intent/patches/`, `.intent/versions/`, `.intent/locks`. IndexedDB holds only undo/redo, autosave and UI state. Atomic writes, monotonic revision numbers, stable object IDs, optimistic concurrency. | The MCP server (Node) cannot read IndexedDB. Git-diffable scenes. Named versions survive a cache wipe. |
| D3 | Agent support | All MCP-capable agents through one MCP server plus generated rule files from one canonical source. Tier 1 (tested every release): Claude Code and Cursor. Tier 2 (best effort): Cline, Codex, Windsurf, Copilot, others. | Maximum reach without multiplying maintenance. Honest support claims. |
| D4 | Release plan | Docs first (all 13), then three vertical-slice milestones M1, M2, M3. Each ends in a working demo. | Gets a stranger to a working end-to-end demo early while keeping the 13-doc discipline. |
| D5 | Export | One Scene JSON, one `Exporter` interface. M1: HTML. M2: basic React. M3: React using the Design Profile. One-way, deterministic. A visual-diff test compares Studio preview and exported HTML. | HTML is easiest to verify. React needs the Scanner for the user's own tokens. The visual test is what proves the match claim. |

## 8. Milestones

| Milestone | Scope | Demo (must run end-to-end) | Tag |
|-----------|-------|----------------------------|-----|
| M1 Walking Skeleton | Schema + engine (text, button, image, container, input); minimal linter (schema, 4/8px grid, contrast, touch target); MCP server with 6 tools; filesystem storage; interview skill with meter and fallback; Studio renders scene, select, per-object feedback, Send to agent; HtmlExporter | Interview, scene, studio feedback, patch, HTML export, on a clean machine | v0.1.0 |
| M2 Real Studio | Drag/resize, pencil layer, comment pins, lock, undo/redo, named versions, compare; multi-screen navigation, states, responsive frames, light/dark; full linter; basic ReactExporter | 3-screen clickable prototype edited by hand and by patch | v0.2.0 |
| M3 Intelligence and Polish | Design Scanner and Design Profile; animations and transitions; intent-profile learning in memory.md; acceptance-rate metric; ReactExporter using Design Profile; Tier 1 end-to-end tests; 5-minute README | Prototype built in the user's own design system, with shorter second interview | v1.0.0 |

Rules: acceptance criteria for each milestone are written in plan.md and test.md before coding. A milestone is not done until its demo runs and its tests pass. Features that do not fit are moved explicitly to the next milestone, never half-built.

## 9. Success Metrics

- **Acceptance rate** = objects accepted unchanged / total objects at export. Target: 97% or more by v1.0.0 on the reference demo scenes.
- **Fidelity:** visual diff between Studio preview and exported HTML stays within the documented threshold. The build fails otherwise.
- **Interview efficiency:** question count falls on the second session for the same user (intent profile working).
- **Time to first demo:** a stranger reaches the working demo in under 5 minutes from a clean machine.
- **Lint pass rate:** share of agent-generated scenes that pass the linter on the first try. Tracked locally.

Honest note: the 97-99% claim is a target measured on reference scenes. It is not guaranteed for every user, because sometimes the user does not yet know what they want.

## 10. Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Agents pull, they cannot be pushed to | Studio edits do not reach the agent automatically | "Send to agent" button and watch mode |
| Agents differ in chat UI, slash commands, and rule formats | Deep Interview breaks in some agents | Plain-text fallback, Studio side panel, generator from one canonical source, tiered support |
| MCP and agent config formats change often | Generated files go stale | Verify against official docs, record versions, drift test in CI |
| Agent writes invalid or ugly Scene JSON | Poor first impression | Zod validation plus linter errors returned to the agent |
| Agent and Studio write at the same time | Lost edits | Revision numbers, atomic writes, reject stale writes |
| Scope too large | Project never ships | Vertical-slice milestones, strict doc discipline |
| Understanding Meter is self-reported | False confidence | Label it an estimate, always show the preview and let the user decide |
| Prototype scenes with prompt-injected text | Security | Escape all scene text, sandbox the preview |

## 11. Open Questions (to resolve in later docs)

- OQ1. Final product and npm package name (working name: Intent / `intent-studio`). Check availability.
- OQ2. Minimum supported Node version (verify against latest LTS).
- OQ3. Exact visual-diff threshold (decide in test.md).
- OQ4. Scene JSON schema versioning and migration policy (decide in architecture.md and trd.md).
- OQ5. Component library for the Studio's own UI (decide in design.md).

## 12. Flags for Later Documents

- **architecture.md:** adapters (Storage, File, Bridge), the `.intent/` layout, concurrency rules, the `Exporter` interface, the MCP server boundary.
- **plan.md:** milestone breakdown, and the change that ReactExporter is split across M2 and M3 (from D5).
- **test.md:** golden-file export tests, the visual-diff test, the generator drift test, Tier 1 end-to-end tests.
- **rules.md:** the canonical-source rule, "never auto-start the Studio", "never modify locked objects".
- **memory.md:** structure of the intent profile and the decisions log.

## 13. Change Log

- 2026-10-22: v0.1
- 2026-10-30: v0.2 — Reconciliation Pass (Step R) applied. Owner accepted all recommendations. Dated change-log entry added per MR-03. created from Master Prompt and decisions Q1-Q5.
