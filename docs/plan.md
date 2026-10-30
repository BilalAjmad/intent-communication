# plan.md: Intent Build Plan

Status: Draft v0.2 | Created: 2026-10-27 | Depends on: prd.md, design.md, architecture.md, trd.md, rules.md, context.md, memory.md, intent.md (all v0.1)

This document says in what order the work is done, what each step delivers, how a step is proven done, and what is cut first if the plan is too big. It contains no calendar dates and no time estimates (P12). Sizes are relative and are corrected from actuals.

Section numbers are stable anchors (context.md CX-08). New content is appended, never renumbered.

---

## 1. Purpose and Planning Rules

| ID | Rule |
|----|------|
| PL-01 | **One step per task.** A task (one agent session or a few) works on exactly one step. A step that needs more than 3 sessions is size L and is **split before it starts**. Size L is never started |
| PL-02 | **Sizes.** S = one session. M = 2 to 3 sessions. L = not allowed (split). The sizes in this doc are initial guesses. After each milestone, record actual sessions per step in memory.md and correct the guesses |
| PL-03 | **Definition of Ready.** A step starts only when: its dependencies are done, its pack (context.md 5.3) is named, its acceptance criteria exist in this doc and in test.md, and the list of failing tests to write first is written down |
| PL-04 | **Definition of Done.** rules R-B42, plus: the step's "Done when" items hold, the demo for its slice (if any) runs, the handoff is written (context.md 7.3), and memory.md is updated |
| PL-05 | **Test first** for logic (R-B24). The "Tests first" line of a step lists them |
| PL-06 | **Vertical slices.** Each sub-slice and each milestone ends in a demo that runs end to end. A horizontal layer alone is never a milestone |
| PL-07 | **Rolling-wave planning.** The next milestone is planned in detail. Later milestones are outlines. A re-plan step runs at the start of M2 and M3 (S-2-00, S-3-00) and is written as a change-log entry here |
| PL-08 | **Scope cuts follow the cut line** (section 8.4). Never cut a "never cut" item. A cut item moves to the next milestone or the parking lot (section 14) in a dated change-log entry. It is never half-built (PRD section 8, R-B03) |
| PL-09 | **No step may change a decision recorded in a doc.** If a step finds the docs wrong, stop, list it (R-B38), and ask (R-B41) |
| PL-10 | **Releases are prepared by the agent and triggered by the user.** Tagging, publishing and pushing happen only when the user asks in chat (R-B33) |
| PL-11 | **Measure, then re-plan.** At each milestone gate, record planned versus actual (steps, sessions, cuts, defects found late) and adjust the next milestone |

Step ID format: `S-<phase>-<nn>`. Phases: `0` (verification and bootstrap), `R` (reconciliation), `1` (M1), `2` (M2), `3` (M3).

## 2. Current Step (L0 block)

The session-start ritual (context.md section 4) reads this section. The agent updates it at the end of every task. Keep it under 40 lines.

```
Active phase:     Phase 0, writing documents (doc 9 of 13 being approved)
Current step:     Write docs/test.md after the user says "next"
Done when:        test.md saved, checked against docs 1 to 9, 5-line summary shown, STOP
Pack:             T-DOC
Next steps:       docs 11 loop.md, 12 review.md, 13 pr.md, then S-0-01 (verification)
Blocked by:       user approval of each doc
Pending rulings:  see memory.md section 6 (do not count by hand)
Parking lot:      PK-01 native shell, PK-02 intent trace, PK-03 reference images,
                  PK-04 resume option on ask_user, PK-05 MCP resources for rules,
                  PK-06 localized fixed lines, PK-07 code-to-scene import,
                  PK-08 Vue and Svelte exporters, PK-09 collaboration,
                  PK-10 "this part matters" button
```

When a code phase starts, this block changes to the step format:

```
Active phase / Milestone / Sub-slice:
Current step:     S-1-04 <title>
Size / Pack:      M / T-CORE
Depends on:       S-1-01, S-1-02 (done)
Tests first:      <list>
Done when:        <the step's "Done when" lines>
Acceptance:       <AC ids this step contributes to>
Parking lot:      <titles only>
```
## 3. Phase Map and Dependencies

### 3.1 Phases

| Phase | Content | Writes code | Gate to leave |
|-------|---------|-------------|---------------|
| 0 | Documents 10 to 13 | No | All 13 docs saved and the user said "next" after the last one |
| 0 verify | S-0-01 Verification Log | No (writes `docs/versions.md` only) | Every VF row verified, or marked UNVERIFIED with a reason |
| R | Reconciliation Pass (section 6) | No | Every Pending item ruled on, change-log entries written, user says "start M1" |
| 0 boot | S-0-02, S-0-03 Toolchain, bootstrap, docs tooling | Yes (tooling only) | CI green on 3 operating systems with an empty product |
| M1 | Walking Skeleton, sub-slices A to D | Yes | Section 8.7 gate |
| M2 | Real Studio, checkpoints A to D | Yes | Section 9 gate |
| M3 | Intelligence and Polish | Yes | Section 10 gate |

### 3.2 Step dependency graph

```
Phase 0 docs (10-13)
   -> S-0-01 verify
   -> S-R-01 .. S-R-05 reconciliation
   -> S-0-02 toolchain and bootstrap
   -> S-0-03 docs tooling
   -> M1.A  S-1-01 schema
              -> S-1-02 core logic (pure)
              -> S-1-03 linter M1 (needs S-1-01, S-1-02 for the layout resolver inputs)
              -> S-1-04 adapters-node (needs S-1-01; core ports from S-1-02)
              -> S-1-05 core write pipeline (needs S-1-02, S-1-03, S-1-04)
   -> M1.B  S-1-06 interview bank and meter (needs S-1-01, S-1-05)
              -> S-1-07 mcp-server (needs S-1-05, S-1-06)
              -> S-1-08 engine and HtmlExporter (needs S-1-01; parallel to S-1-04 to S-1-07)
              -> S-1-09 skills and cli (needs S-1-07, S-1-08)
   -> M1.C  S-1-10 studio server (needs S-1-05, S-1-08)
              -> S-1-11 studio shell and preview (needs S-1-10, S-1-08)
              -> S-1-12 feedback flow (needs S-1-11, S-1-07)
              -> S-1-13 fidelity test (needs S-1-08, S-1-11)
   -> M1.D  S-1-14 end-to-end demo and smoke (needs S-1-09, S-1-12, S-1-13)
              -> S-1-15 M1 gate (needs S-1-14)
   -> S-2-00 re-plan -> M2 checkpoints -> S-3-00 re-plan -> M3
```

S-1-08 depends only on the schema, so it can run in parallel with S-1-04 to S-1-07 if two agents or sessions work in separate branches. The default is sequential.

### 3.3 Critical path

S-1-01, S-1-02, S-1-04, S-1-05, S-1-06, S-1-07, S-1-09, S-1-14. The Studio steps (S-1-10 to S-1-13) are off the critical path for the agent flow, which is why Demo B (section 8.3) can run before any UI exists.

## 4. Phase 0: Remaining Documents

| Doc | Must resolve or contain | Source of the requirement |
|-----|-------------------------|--------------------------|
| 10 test.md | Test strategy and pyramid. Fixtures (one failing and one passing scene per rule). Concurrency tests (two real processes). Visual-diff threshold, fixed fonts and browsers (OQ3, TQ1). Image results for Tier 1 agents (TQ2). Rule-coverage test for M2 and M3 rules (RQ4). Handoff size check (MQ3). Interview simulator and every test in intent.md 17.1. Security tests from trd 22. Budget, drift, pointer-line and word-count tests. **Validation protocol for the 97 percent claim (P8)**. Acceptance criteria per milestone, matching section 8.5 of this doc | trd 26, intent 17, context 17, memory 15, this doc |
| 11 loop.md | The build loop in executable form. Stop-and-report format for three repeated failures (R-B05, R-R22). Context-reset triggers (CX-18). Writing a lesson (LS) and a handoff when a loop stops | rules, context 17, memory 15 |
| 12 review.md | Review checklists per change type. Milestone-end review: Pending items older than the milestone, Unverified rows, rules broken twice (R-G05). Seed checks QR-01 to QR-12. "Context loaded" line present. No doc text copied into code or rule files | rules, context 17, intent 19, memory 15 |
| 13 pr.md | PR template with the R-B39 report including "Context loaded" (C-X7, RQ2). List of touched amendments and waivers (MQ2). Seed id list for bank changes (intent 19) | rules, context, memory, intent |

Rule: each doc is written, shown as a 5-line summary, and approved before the next one starts (R-B02).

## 5. Step 0, Part 1: Verification (docs only)

### S-0-01 Verification Log
- **Size / Pack:** M / T-VERIFY. **Depends on:** all 13 docs saved.
- **Why before Step R:** the rulings on C2, XQ4, AQ4 and the on-request rule delivery depend on what MCP and the agents really support. R-B02 forbids code, not research, so this step is allowed. It writes only `docs/versions.md`.
- **Deliverables:** `docs/versions.md` with one row per trd 2.3 item and per memory.md VF-001 to VF-012: item, verified version, date, official source, and the facts that matter (for example, how Claude Code and Cursor load rules lazily, the exact MCP config path and syntax, whether tool results with images render). Also the npm availability of `intent-studio` (VF-010).
- **Tests first:** none (research). The check is a second look: every row has a source URL and a date.
- **Done when:** every VF row is verified or marked `UNVERIFIED` with the reason (for example, no web access). `UNVERIFIED` rows are listed to the user. Facts are recorded as data, never as instructions (MR-06).
- **If the agent has no web access:** do not fill rows from memory. Ask the user to run the verification with a web-enabled agent, or to paste the official text. This is a blocker, not a shortcut.
- **Also records:** the recommended answers to XQ2, XQ3, XQ4, AQ4, TQ2 and IQ3, as proposals for Step R.
- **Skipping needs a written waiver** (memory section 10), and R-B07 still applies to every later step.
## 6. Step R: Reconciliation Pass (resolves memory M4)

### 6.1 Why

The docs contain many Pending amendments from five documents, and some contradict earlier text (for example T1 versus architecture 10.3). Building on them would encode contradictions in code. The count is computed from the register, never typed (memory M5).

### 6.2 Steps

| Step | Size | Pack | Deliverable | Done when |
|------|------|------|-------------|-----------|
| S-R-01 Build the ruling list | S | T-RECON | A list of every Pending item from memory.md section 6, intent.md 16, this doc's 16, and docs 10 to 13 (when written). Verify each ID exists in its source doc (the check script comes in S-0-03, so this first pass is manual) | List saved in memory.md as section 6.6, counts computed, no item missing |
| S-R-02 Rulings, round 1: decisions | S | T-RECON | Ask the "decide" items **one by one** with options, the recommended option, and the reason (R-B41). At most 5 questions per round | The user answered every "decide" item. Answers recorded with date (MR-03) |
| S-R-03 Rulings, round 2: grouped accepts | S | T-RECON | Items marked "accept" are asked **as groups by source document** (one question per group: "Accept all N items from architecture.md, except the ones you name?"). Options: accept all / accept except / go through one by one. "Info" items are only recorded | The user ruled on every group. Rejected items keep the original text |
| S-R-04 Apply | M | T-DOC | For each Accepted item: a dated change-log entry in the affected doc (R-B38), the doc version raised to v0.2, status set to Applied in memory.md. Section numbers are never renumbered (CX-08) | No Accepted item without a change-log entry. Docs contain no contradiction left from an Applied item |
| S-R-05 Consistency check and handoff | S | T-REVIEW | Re-run the cross-document checks (section references exist, pack references exist, register IDs exist in their docs, budgets add up). Write the handoff | The user says "start M1" in chat |

### 6.3 Ruling order (avoids rework, from intent.md 16)

1. **C-R1** (interview scope), then **I9** (modes). I9 depends on it.
2. **C-R2 with I3** (who derives the profile).
3. **T5 with I2** (meter from evidence).
4. **I1** (`start` kind and the question bank in `core`).
5. **I7** (`brief.json`).
6. **C2** (one `ask_user` tool or a seventh tool). It depends on the verification results.
7. **P1 and P8** from this doc.
8. All other "decide" items added by docs 10 to 13.
9. Grouped accepts.

If the user rejects I1 or I2, the fallback is the one named in intent.md: an `on-request` question-bank file and an agent-reported meter. That fallback needs trd 14.1 and rules R-C02 changes, so the agent lists them before building.

### 6.4 Interpretation of R-B41 (P2)

R-B41 limits each round to 5 questions. Grouped accepts count as one question per group. This is stated here so the agent does not ask 40 single questions. The user can always choose "go through one by one".
## 7. Step 0, Part 2: Toolchain, Bootstrap, Docs Tooling

### S-0-02 Toolchain decisions and repo bootstrap
- **Size / Pack:** M / T-BOOT. **Depends on:** S-R-05, S-0-01.
- **Decisions (recorded as MD entries with the reason):** formatter and linter (Prettier or Biome, one only, trd 2.1), Node version floor (VF-001, PRD OQ2), package name (VF-010, if taken ask the user first, R-B32), CI provider (assumed GitHub Actions, P5, verify), commit-message check tool.
- **Deliverables:** pnpm workspace with the 11 packages as empty shells (architecture 3), strict `tsconfig` (trd 2.1), ESLint rules for banned APIs (R-B16), import-boundary config (R-B13), a purity check for `core`, `linter`, `engine` (R-B14), MIT license, `.gitignore`, hand-written root `AGENTS.md` at most 120 lines from rules Part A (C-R5), README stub, CI workflow with a matrix of Linux, macOS and Windows (P5), dependency audit job, no-network grep job (trd 22.10), conventional-commit check.
- **Tests first:** the boundary check fails on a deliberate bad import fixture. The banned-API lint fails on a fixture. The no-network grep fails on a fixture.
- **Done when:** CI is green on all three operating systems with empty packages, and each check is proven to fail on its bad fixture (not just pass on nothing).

### S-0-03 Docs tooling
- **Size / Pack:** S / T-BOOT. **Depends on:** S-0-02.
- **Deliverables:** `pnpm docs:index` generating `docs/INDEX.md` (context.md 6, including the `H-`, `MD-`, `VF-`, `LS-`, `WV-` heading rule if memory M1 is Applied), `pnpm context:check` with the checks in context.md 13, a register check that every ID in memory.md section 6 exists in its source doc and that counts are computed (memory M5, MQ3).
- **Tests first:** fixtures with a stale index, an over-budget file, a missing pack reference and a wrong register count, each of which must fail.
- **Done when:** the three checks run in CI and pass on the real docs. If they find a real inconsistency, it is listed to the user, not fixed silently.

## 8. M1: Walking Skeleton (tag v0.1.0)

### 8.1 Scope (from PRD section 8, architecture 22, intent 17.2, with P1)

| Area | Included in M1 |
|------|----------------|
| schema | 5 object types, tokens, scene, patches, six ops, errors, config, state, locks, versions, interview state, migrations scaffold |
| core | Ports, index, pure op application, revision and touched-set rules, lock check, canonical serialization, write pipeline, versions, patch lifecycle, virtual `"scene"` target, external-edit reconciliation |
| linter | L-SCHEMA, L-GRID (4 px), L-CONTRAST, L-TOUCH, L-LOCK (in `core`) |
| engine | normalize, RenderModel, `renderCss`, preview renderer, HtmlExporter |
| mcp-server | 6 tools, envelope, budgets, `get_scene` `maxBytes` (if C-X1 Applied) |
| interview | `start`, `next` seeds, bank (35 seeds, with `since` M1 or earlier), server meter and caps, repeat guard, fatigue, summary with source tags, delegation list, Quick mode, resume, `brief.json` write on approval. **Refine mode and `metrics.json` move to M2 if P1 is accepted** |
| server and Studio | Static serving, session auth, M1 routes, SSE, watcher with polling fallback, shell, preview iframe, select (canvas and layers), read-only Inspector, lint panel, Feedback tab, chips, drafts, bottom tray, Send, Copy prompt, Interview tab, empty and error states |
| skills and cli | Canonical files, generators for Claude Code, Cursor and `AGENTS.md`, `.intent/rules/`, `init`, `open`, `mcp`, `export html`, `doctor` |
| tests | Interview simulator, concurrency, security, golden export, visual diff, drift, coverage, budgets |

Not in M1 (explicit): drag and resize, pencil, pins, lock UI, undo and redo, named-version UI, compare, responsive frames, theme toggle in the Studio, full linter, ReactExporter, Tier 2 generators, Scanner, profile learning, animations, SVG assets (P10).

### 8.2 Sub-slices

| Slice | Steps | What exists at its end | Demo |
|-------|-------|------------------------|------|
| M1.A Core spine | S-1-01 to S-1-05 | A tested library that creates, patches, locks and versions scenes on three operating systems. No agent, no UI | **Demo A** |
| M1.B Agent surface | S-1-06 to S-1-09 | Interview and tools work with a real agent. Scenes export to HTML | **Demo B** |
| M1.C Studio | S-1-10 to S-1-13 | The Studio shows the scene, takes feedback and proves preview equals export | **Demo C** |
| M1.D Release | S-1-14, S-1-15 | Clean-machine run, Tier 1 smoke, gate | **Demo D (the full M1 demo)** |
### 8.3 Steps (part 1)

**S-1-01 schema.** Size M. Pack T-SCHEMA. Depends on S-0-03.
- Deliver: IDs (trd 3), primitives and tokens (4), M1 scene and object types (5.1 to 5.4), patch and ops (6), errors (18.2), config (15), state, locks, versions, annotation shell, interview state, canonical serialization (9.5), migration scaffold with one fixture (19).
- Tests first: every schema has one valid and several invalid fixtures. Round-trip serialize is byte-identical. Closed grammars reject free-form CSS. ID regex rejects path characters.
- Done when: `schema` has no dependencies and no Node imports (checked). Fixtures from this step are reused by later steps.

**S-1-02 core: pure logic.** Size M. Pack T-CORE. Depends on S-1-01.
- Deliver: ports (`Clock`, `IdGenerator`, `Hasher`, adapter interfaces), scene index, op application for all six ops with the path whitelist and scope rule, touched set and `rev` rules (trd 6.3), lock inheritance check, hashing helpers.
- Tests first: one test per op and per rejection (path outside whitelist, scope escape, move out of subtree, remove with locked descendant). Property test: applying then re-reading never changes untouched `rev`.
- Done when: no `fs`, `Date.now` or `Math.random` in `core` (checked). Behavior matches trd 6.2 and 6.3 line by line.

**S-1-03 linter M1.** Size M. Pack T-LINTER. Depends on S-1-01, S-1-02.
- Deliver: layout resolver (trd 7.2), L-SCHEMA, L-GRID (4 px, plus the 8 px warn), L-CONTRAST (full WCAG algorithm with the fix hint search), L-TOUCH, deterministic output and merging across themes.
- Tests first: one failing and one passing scene per rule. Contrast table test for the default tokens (trd 4.2). The "no false positive" cases: estimated text width gives `warn`, never `error`.
- Done when: the same code runs under Node and in a browser test. Output is byte-identical across two runs.

**S-1-04 adapters-node.** Size M. Pack T-CORE. Depends on S-1-01 (ports from S-1-02).
- Deliver: `FileAdapter` with path safety (realpath of the parent, `.intent/` only), `writeAtomic` with Windows retry, `withLock` (trd 9.2), `watch` wrapper over the library chosen in S-0-01, stale temp cleanup.
- Tests first: path traversal and symlink fixtures. Two real processes contending for the lock. A killed process leaves a stale lock that is broken. Rename under contention on Windows.
- Done when: all three operating systems pass in CI (P5). Measured numbers for lock timing are recorded in `docs/versions.md` or memory.md as a verified fact (trd 9.2 says to test on all three).

**S-1-05 core: write pipeline.** Size M, split if it exceeds 3 sessions (pipeline versus versions and patches). Pack T-CORE. Depends on S-1-02, S-1-03, S-1-04.
- Deliver: the 15-step write pipeline (trd 8), conflict, lock and scope checks before schema and lint, external-edit reconciliation with `state.json` (9.3), patch files and the status transitions (6.4), coalescing and retention, versions (9.6), virtual `"scene"` target (10.7).
- Tests first: two-writer test with real processes (no lost update, stale write rejected, unrelated objects do not conflict). Lock bypass attempts: move a container holding a locked child, add into a locked container, patch through an ancestor. Hand-edited `scene.json` gets reconciled. Crash between temp write and rename leaves the old file intact.
- Done when: **Demo A runs.** A script (no agent) creates a first scene, patches it, hits a conflict, hits a lock, saves and restores a version, on Linux, macOS and Windows.

**S-1-06 interview bank and meter.** Size M. Pack T-INTERVIEW (P13). Depends on S-1-01, S-1-05.
- Deliver: `packages/core/src/interview/bank.ts` with the seeds from intent.md 6.3 to 6.5 (all `since` M1 or earlier; B3, D4 and B4 are included as data but not served before their milestone), slot model, meter calculation (7.2), caps, repeat guard (SC-5), fatigue hint (SC-4), `reopen`, plain-text card renderer (design 2.4), summary renderer with source tags, interview state file, resume, Quick mode, `brief.json` write on `exactly-right` and the `interview-approved` version when a scene exists.
- Tests first: the bank validity and bank-equals-doc tests (intent 17.1), the meter golden table (69, 86, 91), cap cases, repeat guard, fatigue, delegation list must match exactly, resume after a kill, golden plain-text card.
- Done when: the interview simulator (scripted agent against the real core) completes a small, a medium and a large interview and the final summary matches the golden file.

**S-1-07 mcp-server.** Size M. Pack T-MCP. Depends on S-1-05, S-1-06.
- Deliver: stdio server over the official SDK (as verified in S-0-01), the six tools with Zod-validated input and the `Result` envelope (trd 10.1), `structuredContent` where supported, `isError` on failure, `maxBytes` and truncation, `open_studio` gating (`userRequested`, `quote`), tool-description word budgets (CX-19).
- Tests first: a contract test per tool and per error code. Descriptions at most 120 words each and 700 total. A test that scene text containing instructions never changes tool behavior (R-R24). `ask_user` appends the fixed lines and the server cap applies.
- Done when: an SDK test client drives the six tools against a temp project, and the responses match the error table in rules section 17.
### 8.3 Steps (part 3)

**S-1-08 engine: normalize and HtmlExporter.** Size M. Pack T-ENGINE. Depends on S-1-01.
- Deliver: `normalize`, RenderModel (trd 13.2), `renderCss(model)` shared with the preview, the CSS value allowlist, `Exporter` interface, HtmlExporter (13.4) with the inline script, escaping, URL allowlist, themes, `:target` fallback, warnings list. The preview React renderer lands in S-1-11.
- Tests first: golden-file export per fixture scene. Export twice gives identical bytes. Injection payloads (`<script>`, `javascript:`, quotes, `</style>`) are escaped or dropped. No external URL in any output. `assertSafeCssValue` rejects bad values.
- Done when: the exported file opens by double click in a headless browser, navigation works, and the output has no external requests.

**S-1-09 skills and cli.** Size M. Pack T-SKILLS and T-CLI. Depends on S-1-07, S-1-08.
- Deliver: the four canonical files (the draft of `intent-core.md` is in intent.md Appendix A), the generator and adapters for `AGENTS.md`, Claude Code and Cursor using the formats verified in S-0-01, `merge-block` and `merge-json`, `.intent/rules/`, `init` with `--dry-run`, `mcp`, `open`, `export html`, `doctor` (atomic rename and lock probe, port binding, drift, agent config presence).
- Tests first: the drift test, the rule-coverage test (R-C02), the line-budget test (R-C01), the pointer-line test (context 8.3), `init` never overwrites user content in an existing `AGENTS.md`, `--dry-run` changes nothing.
- Done when: **Demo B runs.** In a fresh folder, `init` configures the project. A real agent (Claude Code or Cursor, by hand, recorded in the smoke checklist) runs the interview, the summary, the first scene and the HTML export without a Studio.

**S-1-10 studio server.** Size M. Pack T-SERVER. Depends on S-1-05, S-1-08.
- Deliver: loopback binding, `runtime.json`, session exchange and cookie, Host and Origin checks, the M1 routes in trd 11.3, SSE with replay, watcher and polling fallback, idle shutdown, security headers, size limits.
- Tests first: the security tests in trd 22 (non-loopback refusal, missing cookie, bad Host, foreign Origin, path traversal, oversize body). SSE reconnect with `Last-Event-ID`. Idle shutdown removes `runtime.json`.
- Done when: all security tests pass on three operating systems, and the server never starts without an explicit command (a test covers `open_studio` without `userRequested`).

**S-1-11 studio shell and preview.** Size M, split if over 3 sessions (shell versus preview protocol). Pack T-STUDIO. Depends on S-1-10, S-1-08.
- Deliver: Vite app, `BridgeAdapter` (HTTP and SSE), shell layout (design 3.1), sandboxed preview iframe with the `srcdoc`, CSP and the channel protocol (trd 12), selection from canvas and from the Layers tree, hover and bounds overlay, read-only Inspector, lint panel, Interview tab, empty, loading and error states (design 7), Studio token set and the headless primitives (design 6, verified versions), the accent color and typeface (design DQ2, recorded as a design.md change-log entry).
- Tests first: iframe cannot reach the network or the Studio's storage (sandbox escape tests). A message from the wrong source or channel is ignored. Layers selection equals canvas selection. Axe has no critical issue on the shell.
- Done when: the Studio renders the demo scene and selection works by mouse and by keyboard.

**S-1-12 feedback flow.** Size M. Pack T-STUDIO. Depends on S-1-11, S-1-07.
- Deliver: the Feedback tab with chips and a text field, `draft` patches on disk, the bottom tray with status text and icons, Send (with the `before-send` version), Copy prompt, SSE-driven status updates, a minimal text-only conflict status (the full conflict banner is M2).
- Tests first: a draft is invisible to `get_feedback` until sent. Sending creates a version. A feedback patch applied by `apply_patch` shows as `applied` in the Studio without a reload. Keyboard-only completion of the whole feedback flow.
- Done when: **Demo C runs.** Select an object, send feedback, tell the agent to check, see the change appear.

**S-1-13 fidelity test.** Size M. Pack T-TEST. Depends on S-1-08, S-1-11.
- Deliver: Playwright test rendering the preview (overlays off) and the exported HTML for each fixture scene, theme and breakpoint, with pinned browser, fixed fonts, disabled animation and a fixed clock, then a pixel diff against the threshold set in test.md (OQ3).
- Tests first: a deliberate one-pixel change must fail the test, so the test is proven able to fail.
- Done when: the test is stable (no flake in 20 consecutive CI runs on each operating system), or it runs on one pinned OS image with the reason written down. A flaky test is a bug (R-B26).

**S-1-14 end-to-end demo and smoke.** Size M. Pack T-TEST. Depends on S-1-09, S-1-12, S-1-13.
- Deliver: the Demo D script below, run on clean machines, a Tier 1 **manual smoke checklist** for Claude Code and Cursor (P6) recorded with agent versions and dates, the README 5-minute path, a "stranger test": one person who did not build it follows the README on a clean machine. The result and the real time taken are recorded as measured, not claimed.
- Done when: all items in 8.5 that depend on this step hold.

**S-1-15 M1 gate.** Size S. Pack T-REVIEW. Depends on S-1-14.
- Deliver: the review (review.md), the gate checklist in 8.7, planned-versus-actual record (PL-11), docs change-logs, memory handoff, and a release candidate. The user decides about the tag (PL-10, R-B33).
### 8.4 Cut line for M1 (what goes first if M1 is too big)

| Order | Cut | Cost of cutting | Allowed without a ruling |
|-------|-----|-----------------|--------------------------|
| 1 | `metrics.json` and its reports | None for the demo | Yes, if P1 not accepted yet it is already a "Could" |
| 2 | Refine mode and carry-over | Repeat requests re-interview fully | Yes |
| 3 | Studio Interview tab | Interview works in chat plain text only. design 14 M1 criterion needs a ruling | **No**, needs the user |
| 4 | Cursor Tier 1 smoke (keep Claude Code) | Less reach evidence. The README must say Cursor is untested in v0.1.0 | **No**, needs the user |
| 5 | Windows CI | Windows behavior unproven | **No**, never cut quietly. Windows support would have to be declared unsupported |

**Never cut:** the write pipeline guarantees (atomic write, lock, revision, scope), escaping and the CSP, the sandboxed preview, L-CONTRAST and L-TOUCH, the visual-diff fidelity test, the drift and coverage tests, the server-appended "Don't know" and "Skip" lines, the meter caps, honest labeling of numbers.

### 8.5 M1 acceptance criteria

| ID | Criterion | Proven by (test.md names the test) |
|----|-----------|-------------------------------------|
| AC-M1-01 | `npx intent-studio init` and `doctor` succeed on Linux, macOS and Windows runners | CI matrix |
| AC-M1-02 | Interview simulator completes small, medium and large tasks. Meter path, caps, fatigue, delegation list and resume match golden files | S-1-06 tests |
| AC-M1-03 | Six tools pass contract tests for every error code. Descriptions within budget | S-1-07 tests |
| AC-M1-04 | Two real processes never lose an update. Stale writes are rejected. Locks cannot be bypassed through ancestors. Atomic writes hold on three operating systems | S-1-04, S-1-05 tests |
| AC-M1-05 | Each M1 linter rule has a passing and a failing fixture. Output is deterministic. No false-positive errors on estimated sizes | S-1-03 tests |
| AC-M1-06 | Export is byte-identical on repeat. Injection payloads are neutralized. No external URL in output | S-1-08 tests |
| AC-M1-07 | Preview versus exported HTML is within the threshold for every fixture scene, theme and breakpoint | S-1-13 test |
| AC-M1-08 | Security tests pass: loopback only, token, Host, Origin, path traversal, sandbox escape, banned APIs, no network calls outside the allowlist | S-1-10, S-1-11, CI |
| AC-M1-09 | Studio flow works by mouse and by keyboard only: render, select, feedback, draft, send, status update | S-1-12 tests |
| AC-M1-10 | `init` generates the files, `--dry-run` changes nothing, the drift test, coverage test, budgets and pointer lines pass | S-1-09 tests |
| AC-M1-11 | The Tier 1 smoke checklist is recorded for Claude Code and Cursor with versions and dates. No Tier 2 claim is made | S-1-14 |
| AC-M1-12 | Types strict, no `any`, boundaries clean, audit clean, docs index fresh, no unruled Pending item older than this milestone | CI, review |
| AC-M1-13 | The Demo D script runs from a clean machine and is written in the README. The stranger-test result is recorded as measured | S-1-14 |

### 8.6 Demo D script (the M1 demo)

1. In an empty project, run `npx intent-studio init --dry-run`, read the diff, then run it for real. Run `doctor`.
2. Open Claude Code (or Cursor). The agent sees the MCP server.
3. Say "Design a booking app for my salon". The agent runs the interview: about 8 questions, tap-style or numbered options, a visible estimated understanding, and "Don't know, you choose" on each.
4. The agent shows "Here is what I understood", including a "chosen by me" list. Choose "Exactly right".
5. The agent validates, then applies a first scene of 2 screens. A linter error is shown being fixed by the agent at least once in the recorded run (a deliberately tight fixture, so the self-correction path is exercised).
6. The agent offers the Studio once. Say "open the studio". The agent calls `open_studio` and gives the URL.
7. In the Studio, select the main button, add the chip "bigger" and a sentence, press Send.
8. Tell the agent "check my feedback". The agent reads it, reads the object, applies one patch, and reports what changed.
9. The Studio shows the patch as applied. Run `npx intent-studio export html`. Open the file by double click: navigation between the two screens works.
10. The visual-diff test for this scene passes in CI.

### 8.7 M1 gate

All AC-M1 items hold, Demo A to D ran and were recorded, the review was done (review.md), planned versus actual is recorded, docs have change-log entries for everything changed during M1, and the handoff is written. Then the user decides about the tag (`v0.1.0`) and any publishing (PL-10, R-B33).
## 9. M2: Real Studio (outline, tag v0.2.0)

Detailed steps are written in S-2-00. This is the scope and the checkpoints.

| Step | Checkpoint | Scope (from PRD, design 4 and 9, architecture 22, trd 5 to 7, 13) |
|------|------------|---------------------------------------------------------------------|
| S-2-00 | Re-plan | Read the M1 actuals. Detail the M2 steps. Verify again the versions for M2 libraries (Moveable, perfect-freehand, IndexedDB access, SVG sanitizer TQ4). Decide TQ5 (modal and menu model). Move Refine mode and `metrics.json` here if P1 was accepted |
| M2.A | Schema and engine growth | Object types checkbox, radio, switch, link, list, modal, icon, divider. Components and instances. `states` end to end. Responsive overrides. Annotations. ReactExporter (basic, CSS variables). Engine uses the same RenderModel |
| M2.B | Linter and agent surface | Full ruleset (L-TYPE, L-TOKEN, L-STATES, L-ALIGN, L-HIER, L-A11Y, L-CONTENT). `get_feedback` with annotations and images. Watch mode (best effort). Tier 2 generators. MCP hardening |
| M2.C | Studio editing | Drag, resize, snap, guides, Inspector editing with the state switcher, undo and redo (IndexedDB), lock button and tool, pencil layer, comment pins, named versions, compare, conflict banner, multi-screen navigation, device frames, light and dark, axe checks |
| M2.D | Integration | Demo: a 3-screen clickable prototype edited by hand and by patch. Benchmarks become blocking (trd 21). Tier 2 smoke by best effort. Gate |

M2 acceptance (final list in S-2-00): design 14 M2 items, the full linter fixtures, ReactExporter golden files and a visual test for it, conflict tests in the Studio, and the performance benchmarks of trd 21. One tag at the end. The checkpoints have demos but no tags (P9).

## 10. M3: Intelligence and Polish (outline, tag v1.0.0)

| Step | Scope |
|------|-------|
| S-3-00 | Re-plan from the M2 actuals. Re-verify versions older than 90 days (memory section 7) |
| M3.A | Scanner and Design Profile (trd 16), linter context from the profile, badge in the Studio, ReactExporter using the profile (trd 13.7) |
| M3.B | Profile learning (intent 11): `signals.json`, derivation, CT4 and prefill, `+` remember, settings page for remembered preferences, `interview.depth`, seed B4 enabled, efficiency report |
| M3.C | Animations and transitions (CSS only, reduced motion respected). Acceptance-rate metric and its Studio view (trd 17.2) |
| M3.D | Tier 1 end-to-end automated tests (PRD M3). The validation protocol of P8 (reference scenes and the small human trial). README 5-minute path re-tested. Docs cleanup. Gate |

M3 acceptance: PRD section 8 M3 demo (a prototype in the user's own design system with a shorter second interview) and the intent.md 17.2 M3 items.

**Honest limit on the 97 percent target.** The acceptance rate (trd 17.2) measures objects accepted unchanged. On scripted fixtures it only shows the pipeline works. It says little about real users' intent. P8 proposes a documented small trial with real people and wording that reports what was measured, including when the number is below target.

## 11. Release and Gate Process

1. **Gate checklist** per milestone: acceptance criteria, demos recorded, review done, docs change-logs, memory handoff, planned-versus-actual, Pending items ruled, `UNVERIFIED` rows listed.
2. **Release candidate** is a branch state, not a tag. The agent prepares the changelog, version bump and notes.
3. **Only the user triggers** tagging, `git push`, npm publishing and PR creation (R-B33, PL-10).
4. **After a release:** re-verify version facts older than 90 days (memory section 7). Write a lesson for every defect that was found after the gate.
## 12. Open Questions Resolved Here (proposals, pending the user's ruling)

| Question | Proposed resolution | Amendment |
|----------|--------------------|-----------|
| TQ3 Windows CI from M1 or M2 | From M1. Atomic rename and lock behavior differ on Windows, and R-B21 requires cross-platform from day one | P5 |
| RQ3 Which R-B rules are automated in M1 | R-B11, B12 (tests at boundaries), B13, B14, B16, B19, B21, B28, B29 (audit), B34 (commit check), B35 (drift). Axe for R-B22 starts in M2. The keyboard-only flow test is in M1. R-B05 to R-B10 and R-B36 to R-B42 stay conventions | P5 |
| DQ3 and IQ1 Localization | English only in v1. Studio strings and the fixed interview lines go through a message catalog from M1 so languages can be added later. No RTL in v1 (intent 6.3 C3 already says so) | P7 |
| XQ1 Pack size measure | Report line counts from `docs/INDEX.md` and an estimate of bytes divided by 4, labeled an estimate. Target stays 1,200 lines. Tune after M1 | none |
| DQ2 Accent color and typeface | Chosen in S-1-11 and recorded in design.md's change log | none |
| TQ4 SVG sanitizer | M1 rejects SVG assets with `E_BAD_REQUEST` until a sanitizer is verified and chosen at S-2-00 | P10 |
| OQ1 Package name | Verified in S-0-01. If `intent-studio` is taken, ask the user before renaming (R-B32) | none |
| OQ3, TQ1, TQ2, RQ4 | Left to test.md (doc 10) | none |

## 13. Risks

| Risk | Impact | Mitigation | Early signal |
|------|--------|-----------|--------------|
| M1 is too large | The first end-to-end demo arrives late or never | Sub-slices with their own demos (P4). Cut line (8.4). Rolling-wave planning | Any step over 3 sessions, or Demo B not running by the end of M1.B |
| Agent and MCP formats differ from the docs | Generated files or tools fail in Tier 1 agents | S-0-01 verification before code. Format knowledge isolated per agent adapter. Smoke checklist in M1 | A smoke step fails on a real agent |
| Cross-platform file behavior | Lost or torn writes on Windows | Real-process tests on three operating systems from S-1-04 | Flaky concurrency tests |
| Visual-diff test is flaky | Teams start ignoring red builds | Pinned browser and fonts, proven-to-fail test, flake counter (20 runs) | Any rerun to get green |
| Agents ignore the rule files | The interview or patches go wrong | Important rules enforced by the server. Smoke checklist records real behavior. Honest limits (rules section 19) | Smoke run skips the interview |
| Verification impossible without web access | Everything stays UNVERIFIED | Ask the user for a web-enabled run. Never fill from memory | S-0-01 cannot reach official docs |
| Rulings take long or are skipped | Code on contradictory docs | Step R is a gate. A waiver must be written (memory section 10) | The user says "start" with Pending items open: ask once, record the waiver |
| Scope creep from "ultra advanced" wishes | M1 never ships | PL-08, parking lot, cut line | New items appear that are not in the docs |
| 97 percent target cannot be shown with fixtures | An empty claim | P8 protocol. Report only measured numbers (R-R35) | Pressure to quote the target as a result |

## 14. Parking Lot

Ideas and deferrals. An item here is not scheduled. Moving one into a milestone needs a change-log entry and the user's ruling.

| ID | Title | Source | Note |
|----|-------|--------|------|
| PK-01 | Native shell (Electron or Tauri) | PRD NG4, D1 | Adapters keep the door open |
| PK-02 | Intent trace per scene object | intent IQ2 | Would sharpen edit signals and per-topic acceptance |
| PK-03 | Reference images as interview input | intent IQ5 | Revisit after v1.0.0 |
| PK-04 | `resume` option on `ask_user` or a seventh tool | context C-X2, trd C2 | Only if real use shows `start` resume is not enough |
| PK-05 | MCP resources or prompts for the on-request rules | context XQ4 | Depends on VF-011 |
| PK-06 | Localized fixed lines and RTL support | intent IQ1, design DQ3 | After the message catalog exists |
| PK-07 | Code-to-scene import | PRD NG2 | One-way export in v1 |
| PK-08 | Vue and Svelte exporters | PRD D5 | A new plugin on the `Exporter` interface |
| PK-09 | Real-time collaboration | PRD NG3 | |
| PK-10 | "This part matters a lot" button that opens deep-dive seeds | intent IQ4 | Decide in M2 planning |
## 15. Traceability

| Requirement | Steps |
|-------------|-------|
| FR-A1 to FR-A7 | S-1-06, S-1-07, S-1-09 (rule file), S-1-11 (Interview tab) |
| FR-A8 | S-3 (M3.B) |
| FR-B1 | S-1-07 (`open_studio`), S-1-09 (`open`), S-1-10 |
| FR-B2 | S-1-08, S-1-11 (M1 render). Navigation, states, responsive, light and dark: M2.A, M2.C |
| FR-B3 | S-1-12 (feedback). Drag, resize, pencil, pins, lock, undo, versions, compare: M2.C |
| FR-B4, FR-B5 | S-1-05, S-1-07, S-1-12 |
| FR-B6 | S-1-08 (HTML), M2.A (React basic), M3.A (React with profile) |
| FR-B7 | M2.A |
| FR-S1 | S-1-07 |
| FR-S2 | S-1-03 (M1 rules), M2.B (full) |
| FR-S3 | M3.A |
| FR-S4 | S-1-09 |
| NFR-1, NFR-2 | S-1-08, S-1-10, S-1-11, CI checks from S-0-02 |
| NFR-3 | S-1-02, S-1-08 |
| NFR-4 | S-1-03 (L-CONTRAST, L-TOUCH), S-1-11 (axe), M2.B (L-A11Y) |
| NFR-5 | M2.D (benchmarks blocking) |
| NFR-6 | S-0-02 (boundary check) |
| NFR-7 | S-1-04, S-1-05 |
| NFR-8 | S-0-02, S-1-01 |
| NFR-9 | S-0-01, S-0-03 |
| PRD M1 table | Section 8.1, steps S-1-01 to S-1-15 |
| PRD M2 table | Section 9 |
| PRD M3 table | Section 10 |
| PRD section 9 metrics | Fidelity: S-1-13. Time to first demo: S-1-14. Lint pass rate: M2.B. Acceptance rate and interview efficiency: M3.B, M3.C |
| architecture section 22 | Section 8.1 table |
| memory M4 | Section 6 |

## 16. Conflicts, Amendments and Flags

Nothing in earlier documents has been changed silently. Each item needs the user's ruling, then a dated change-log entry in the affected document.

| ID | Conflict or amendment | Affects | Rec |
|----|----------------------|---------|-----|
| P1 | **M1 scope growth.** PRD section 8 lists the M1 | PRD 8, architecture 22, intent 17.2 | **decide** |
| P2 | **R-B41 grouping.** R-B41 limits 5 questions per round. Grouped accepts count as one question per group. This is stated here so the agent does not ask 40 single questions | rules R-B41, section 6.4 | accept |
| P3 | **context.md does not exist yet.** Plan.md references context.md section 5.3, 6, 11, 13, 17, CX-08, CX-18, CX-19. Since context.md is doc 6 and plan.md is doc 9, this is a forward reference. The forward references must be verified when context.md is written | context.md (doc 6) | accept |
| P4 | **Vertical slices over horizontal layers.** Each M1 sub-slice has a demo (P4). This is already in the plan | PRD D4, PL-06 | accept |
| P5 | **Automated R-B rules and Windows CI.** TQ3 and RQ3 resolved here as proposals P5. Windows CI from M1, automated list as shown | TQ3, RQ3 | **decide** |
| P6 | **Tier 1 smoke is manual by hand.** P6 recorded as a manual smoke checklist, not automated. This is honest and matches the M1 gate | PRD M3, AC-M1-11 | accept |
| P7 | **Localization deferred.** English only, message catalog from M1. No RTL in v1 | DQ3, IQ1 | **decide** |
| P8 | **97 percent validation protocol.** The acceptance rate (trd 17.2) on fixtures does not prove the claim. P8 proposes a documented small trial with real people and honest reporting | PRD section 9, trd 17.2 | **decide** |
| P9 | **M2 checkpoints have demos but no tags.** PL-07 says tags only at milestones. Checkpoints have demos for progress visibility | PL-07 | accept |
| P10 | **SVG sanitizer deferred to S-2-00.** M1 rejects SVG with `E_BAD_REQUEST` | TQ4 | **decide** |
| P11 | **`metrics.json` and Refine mode are "Could" in M1.** They move to M2 if P1 is accepted. Cut line 8.4 orders them first | P1 | accept |
| P12 | **No calendar dates or time estimates.** This doc uses relative sizes and records actuals. PL-02 | PL-02 | accept |
| P13 | **context.md section 5.3 has no pack for interview work.** The `T-INTERVIEW` pack is defined here for S-1-06. context.md will define it in doc 10. The forward reference is noted | context.md 5.3 | accept |

## 17. Change Log

- 2026-10-27: v0.1
- 2026-10-30: v0.2 — Reconciliation Pass (Step R) applied. Owner accepted all recommendations. Dated change-log entry added per MR-03. created from prd.md, design.md, architecture.md, trd.md, rules.md, context.md, memory.md, intent.md v0.1. Proposes P1 to P13.
5. **Semantic versioning.** Any new `schemaVersion` is at least a minor bump (trd 19).