# Intent Communication — Full Project & Session Context
**Source of truth. Updated 2026-11-14 ~00:00 (after Phase 8 of this session).**

---

## Repo layout & git state
- Path: `H:\intent communication`; git repo, branch `main`
- HEAD = `0863874` — "docs: record Demo D and real Tier 1 smoke execution results" (check your `git log --oneline`). After the Phase 8 doc updates in this session, HEAD will have two additional commits (see bottom).
- Working tree: mostly clean except this pass's doc edits.
- `.kilocode/rules/AGENTS.md` and project-root `AGENTS.md` bind all future agents to the MASTER AGENT RULES file.
- Extra branch in the same repo? no. Worktree `H:\intent-phase2-concurrency` (branch `phase2-concurrency`, based on `4b581af`) is redundant — kept in case you want it; to delete requires an explicit destructive-action confirmation.

## Current verified state (measured, this session, Windows 11, Node v22.23.4, pnpm 9.7.1)

- `pnpm verify` → **12/12 PASS**.
- Unit/integration: **286/286** across 10 packages.
- Multi-process: 2/2 different-objects, consecutive 10× green.
- Mutation proof: 5/5 mutations detected.
- Tier 1 Playwright smoke: 5/5 incl. `init → doctor → export → open with zero network`.
- Visual-diff: 11/11.
- Status of SSE: `/events` authenticated, emits initial revision seeded from scene, broadcasts on successful `apply_patch`, end-to-end test proves it.
- Studio preview renderer: `packages/studio/src/preview.ts` emits a sandboxed srcdoc HTML document distinct from the exporter.

## Concurrency (major subsystem)

- Object lock design: `locks/<sceneId>.locks.json` registry (alt to initial per-object `.lock` files).
- Each locked object has `{ id, pid, ownerToken, createdAt }` in `.intent/locks/…json`; dead owners or entries older than 10 s are reclaimed on next acquire (`stale-owner reclaim`).
- `readLocks`/`writeLocks` are atomic-write+rename with fsync and lstat symlink guard.
- Atomic write pattern: write `<path>.tmp.<rand>` then `rename`; on Windows, `fsync`+`rename` may throw `EPERM`/`EBUSY` — `atomic.ts` retries with jitter (20–320 ms).
- Dispatcher order in writePipeline is: acquire scene lock (ownerToken-verified) → acquire object locks → read+verify revision → applyPatch → write scene → release object locks → release scene lock. Stale writes rejected by revision check (`E_CONFLICT`) and patch `baseRevision` check.

## Security posture (post-audit)

- Exported HTML cannot execute attacker-controlled scripts. Two classes of XSS closed and browser-verified.
- `/mcp`, `/events`, every `/api/*` require session cookie; token exchange at `/api/session` sets `SameSite=Strict` `HttpOnly`; cookie `Path=/api`; 256-bit random session id; `timingSafeEqual` comparison.
- Preflight (OPTIONS) is refused with 403. Exact `Host` required. `Origin` match required on non-GET. `Referrer-Policy: no-referrer` and `Content-Security-Policy: default-src … frame-ancestors 'none'`.
- `gitleaks` clean; `trivy` clean at all severities (no known vulns in our files); `pnpm audit` HIGH (zod GHSA-mrhx-c7xc-m3w5) closed by schema bounds enforcement (every array in zod schema now has `.max()` matching trd 20 limits; text 2000 chars).

## Remaining per AC-M1 (this session's audit, see docs/review.md §21)

- AC-M1-01 (Linux/macOS CI) — CI config is correct; runs not observed by this session.
- AC-M1-03 — six-tool error-code contract tests — partial, not full matrix.
- AC-M1-07 — pixel-level fidelity preview-vs-export harness — not built.
- AC-M1-09 — full select→draft→send→status in a browser, keyboard-driven — not driven end-to-end.
- AC-M1-11 — Tier 1 agent-driven (Claude Code / Cursor) recording — no agent session driven in this session.
- AC-M1-13 — Demo D stranger-test not recorded.
- AC-M1-01..13 verdict in `docs/review.md` section 21.1: **NOT READY for v0.1.0** (not stopping based on code state; stopping based on per-AC evidence).

## Decision log (phase 9 addendum: see context.md Phase 9)


- 2026-11-13 — adopt phase 0/1 checkpoint; adopt R-B1..R-B4 rework; fix skills backtick; fix server lock-port wiring; remove PowerShell liveness (hugely slow on Windows); gate on Crockford ULID regex.
- 2026-11-13 — adopt writeAtomic + locks.json registry design from parallel agent's rework; extend it to reclaim stale object owners; add `owners` to `LocksFileSchema`; `readScene` validates via Zod; `writePipeline` rejects stale baseRevision; applyPatch rejects `..`, `__proto__`, empty segments; enforce trd 6.2 root-whitelist for set/unset; path and text lengths capped at trd 20 limits.
- 2026-11-13 — escape JSON for `</script>`; CSP in the exported file; `url()` and `javascript:` dropped by `sanitizeUrl`/`sanitizeCssValue`; `safeClassToken` replaces raw `props.variant` always; attribute-level injection closed.
- 2026-11-13 — MCP conformance test rewrite (`expect(true).toBe(true)` removed; checks now inspect real exports).
- 2026-11-13 — server auth built to spec: token exchange sets `HttpOnly SameSite=Strict Path=/api` 256-bit random session id; `/mcp`, `/events`, `/api/protected` require cookie; POST requires `Origin` == http; GET does not; OPTIONS refused; Host must be loopback; `Referrer-Policy: no-referrer` added.
- 2026-11-14 — SSE baked into `/events`: `handleSSE` seeds revision from scene; `handleMCP` broadcasts revision on `apply_patch` success to the channel matching the patch's `sceneId`; end-to-end SSE test added.
- 2026-11-14 — separate preview renderer added (`packages/studio/src/preview.ts`); unit and keyboard-only Playwright tests.
- 2026-11-14 — `--dry-run`, drift and budget CLI tests; CI apt fix.
- 2026-11-14 — Tier 1 smoke executed with real results (CHECKLIST.md); Demo D transcribed.

## Artifacts you can trust

- `VERIFY-REPORT.md` — 2026-11-14 run, 12/12 PASS, unit+integration 286/286.
- `docs/review.md` §21 — AC-M1 audit; §21.1 gives verdict **NOT READY v0.1.0**.
- `docs/change-log-m1.md` — this file is authoritative for commit list and gaps.
- `docs/INDEX.md` — regenerated by `pnpm docs:index`.
- `docs/security-audit-2026-11-13.md` — full security sweep.
- `docs/plan.md` §8.3.1 — measured S-1 status (evidence-backed).

## What this file used to say (now obsolete, intentionally removed)

- "Remaining blocker: E_LOCKED cascade" — resolved via registry-with-owner-metadata rework.
- "252/263 tests pass" — superseded by 286/286.
- "Studio preview not implemented" — now implemented as separate renderer (`packages/studio/src/preview.ts`).
- "SSE not implemented" — now wired; revision broadcast on `/mcp` apply_patch.
- "Demo D not written / smoke checklist empty" — both done 2026-11-14.
- "README verification table made-up numbers" — now counts are measured from `pnpm verify`.
- "Phase 2 competitor work conflicted with Phase 2" — registry-versus-wx was reconciled into the intent-correct registry form with stable writes (fsync+rename).

## Notes on other agents

- Two agents were observed editing this tree concurrently on 2026-11-13 (a parallel Kilo/Cline session). They did not use a git worktree, and the impact was: file mtime collisions, near-miss regressions, and cleanup sessions for `fix_*.py`/`fix_*.ps1` artifacts. This session resumed with: (i) full build, (ii) all tests, (iii) all docs refreshed from measured reality.
- The untracked `AGENTS.md` in the project root and `.kilocode/` are intentional: they wire every future agent to this strict rule set.

## Handoff for next agent (Phase 8 explicit)

- Read this file, then read `docs/change-log-m1.md`. Then run `pnpm verify` and confirm it's green on your machine.
- Do not touch `.kilocode/` or `AGENTS.md` unless the user asks.
- Do not create a `phase2-concurrency`-style duplicate branch — refine on `main`.
- The only safe-to-merge path forward is: close AC-M1-01/03/07/09/11/13 gaps honestly, re-run verify, re-audit, get user's `git tag v0.1.0` ruling.


## Phase 9 addendum (2026-11-16 — full review+fix loop)
- Every package was re-read; confirmed bugs fixed (pipeline all-or-nothing, ports split + strict readers, atomic same-dir tmp, lock reclaim quarantine, engine/linter/studio hardening, server outer catch + cross-process locks, schema summary kind added).
- Bank/meter expanded so the interview is honest: 53 askable seeds, 42 large-scope slots all covered; golden files regenerated; SC-4 fatigue trigger implemented.
- Verify 12/12 PASS (412/412 unit), Playwright 77/77, mutation proof 5/5, context:check green.
- Still open: M2/M3, CI observation, Tier-1 agent session (OpenRouter 402; Cursor CLI absent), stranger test, zod 3→4, LICENSE, push/tag — all user decisions. M1 gate NOT READY.

## Phase 12 addendum (2026-11-16 — M2.B/M2.C/M2.D wiring + real race fix)
- **Multi-process race root-caused and fixed** (lock-port.ts): stale-reclaim treated a 10s-old lock as dead even with a live owner pid; under full-verify load a starved lock holder was reclaimed and two processes both wrote revision 1. Age tiebreaker is now 60s; pid-liveness is primary. 10/10 stress runs + 2 consecutive full verify runs green. (commit cf5a988)
- **Named-version restore** (trd 6.x): /api/versions list + /api/versions/:file/restore (validate, revision bump, SSE broadcast); Inspector Snapshots section (blank-inspector-on-boot fixed); 5 server API tests + Playwright e2e. (commit 97034d2)
- **Linter surfaces end to end** (ca5de9f): MCP `validate` returns lint verdicts (type=scene); `GET /api/lint`; topbar Lint chip with toggleable accessible panel (Escape closes; live-updates on SSE revision); Playwright 2/2. Full M2 ruleset was already merged (69d1c37).
- **M2.D integration demo** tests/m2d-demo.spec.ts (4a742fc): seed 3-screen scene → Studio → draw annotation → attach to feedback → send → MCP `get_feedback` returns feedback + annotation summary → agent `apply_patch` (no API key, no external services) → export renders patched copy with zero external requests. Playwright 80/80 → 84/84.
- Unit 558 → 567/567; verify 12/12; Playwright 84/84.

## Phase 11 addendum (2026-11-16 - M1 gate CLOSED BY OWNER WAIVERS + deps zero)
- pnpm audit 18 -> 0: vitest 2.1.9 -> 5.1.0, vite 5.4.21 -> 8.3.8 (root+studio), @types/node -> ^22, @typescript-eslint 8.72.2, pnpm override minimatch >=7 <11 -> ^11.0.1 (commits 9ff7419, 06ec726). verify 12/12, unit 552/552.
- AC-M1-06: byte-identical exportToHtml determinism test added.
- RC.md rewritten with dated owner rulings 2026-11-16: AC-M1-11 waived (project has NO agent/runtime dependency - the project never needed one; tests/smoke/CHECKLIST.md stays empty by design), AC-M1-13 stranger test waived (Demo D walkthrough EXECUTED automatically - tests/tier1-smoke.spec.ts 5/5, Windows 11 - never claimed as human evidence), Linux/macOS ACs waived (Windows-11-only evidence). Gate verdict: M1 CLOSED BY OWNER WAIVERS - tag/push/publish NOT done; owner's call alone.
- Playwright 79/79; demo-d.md/versions.md/plan.md RC references synced.

## Phase 10 addendum (2026-11-16 — M2.A build-out)
- M2.A done except Studio UI work: object types, states, responsive, components/instances, annotations (data model + agent surface), ReactExporter basic + CLI export wired.
- Verify 12/12, unit 529/529, Playwright 77/77. M2 ≈ 35%. Whole project ≈ 40%. M1 gate still NOT READY.

## Phase 13 addendum (2026-11-17)

- **RenderModel (trd 13.1/13.2, d90b2da):** normalizeSceneToModel is pure/deterministic; tag+attr allowlists enforced inside the model; component instances expanded with derived `<inst>::<inner>` ids; interactions collected as data; cycle rejection via E_LIMIT; `style-decl.ts` one CSS-declaration splitter (number-px unitless props fixed: font-weight etc. no longer ship as 700px); `vars.ts` one palette source; both exporters and the Studio preview render through ONE shared renderer (render-html.ts) — fidelity preview==export is structural, verify 12/12, Playwright 84/84. RC § Deviations updated.
- **trd 17.2 acceptance-rate metric (43c04ab):** first-render marker (mcp-server first-render.ts) written on the first successful apply_patch; pure compute in core/metrics.ts (acceptanceRate = baseline still-present and not touched by applied patches / baseline still-present; unavailable reasons when denominator is empty); `GET /api/metrics`; Studio Inspector "Acceptance" section (SSE refresh; honest "Not enough data yet" empty state); `intent export` prints one-line summary as export OUTPUT metadata only (never embedded in artifacts).
- **Multi-process flake root-caused and fixed for good:** the 60s age cap (my cf5a988 mitigation for the age-only reclaim bug) hid a worse problem — Windows pid reuse made a dead worker's lock entry unreclaimable for 60s; worker 2 starved through 50 retries (E_LOCKED) and verify went red at ~20% rate. trd 9.2 rules restored: age cap 10s, pid-liveness PRIMARY (a live-but-starved owner is never reclaimed, cf5a988 cannot reoccur); 24 debug-harness iterations + 10/10 stress runs clean; verify 12/12.
- **Scanner (trd 16, d7985ed):** `intent scan` walks an allowlist only (tailwind.config.{ts,js,cjs,mjs} — TypeScript AST literal extraction, never eval; components.json; W3C tokens.json / **/*.tokens.json; CSS :root under src/app/styles; .storybook/main presence; package.json UI deps). Deterministic (sorted; generatedAt = newest source mtime); strict zod schema; unresolved listed with reasons; node_modules/dist/build skipped; nothing executed ever.
- **Intent Profile learning (trd 17.1, d5cc753):** signals from answers only (closed key list; 2 weak signals or 1 explicit statement activate; dislikes captured normalized; entries never hold scene text); mergeSignals is pure (an earlier input-mutation made recordAnswerLearning see no diff and skip the write — found and fixed with a regression test); get_scene adds metadata.profileSummary; ask_user returns preFilled for mapped topics; Studio Profile tab (roving tabindex; view/edit display text/delete; key/value/confidence NOT editable through the API by design).
- **M2.C drag/resize (113ee54):** hand-rolled — Moveable still NOT added (owner ruling pending). 4px grid snap, Alt disables; flow objects convert to position:absolute at drop point; one gesture = one atomic style op via new `POST /api/object-style` (writePipeline — same lock/revision/E_CONFLICT path as the agent's apply_patch; user edits never enter the agent feedback queue nor the acceptance metric); locked objects show no affordances; overlay root cause fixed (.overlay is pointer-events:none by design; boxes opt in only when draggable).
- **React export visual proof (this commit):** tests/react-export.spec.ts bundles the exported folder (esbuild, root devDep) and byte-compares `.intent-text` against exportToHtml — PASS. Along the way the export's app shell got the height chain fixed (`.intent-app { height:100%; ... }` in shared tokens.css; React shell is now a div, no nested `<main>`); goldens regenerated.
- Verify 12/12; unit 619/619; Playwright 93/93; audit 0; 500-line budget held (server index.ts 499). M2 ≈ 70%; M3 started (Scanner, 17.1/17.2, reduced-motion guard) but not complete.
- **Remaining honest list:** S-2-00 re-plan NOT run (deviation PL-07); M3 profile→React/Tailwind class mapping not built (trd 13.7); animation authoring surface absent (reduce-motion guard exists; inline transitions pass sanitizer); undo/redo; keyboard nudge; benchmark gates (documented-not-blocking); Studio axe full-check; LICENSE + tag/push/publish remain owner decisions (never agent-decidable); 97% acceptance target unmeasured (no real sessions; fixtures only).

(Updated 2026-11-17.)

## Phase 14 addendum (2026-11-17 — Animation slice, keyboard nudge, 4-pass review fixes)

- **Animation end-to-end (trd 13.6):** RenderModel splits animation/transition declarations into node.anim; renderAnimationCss emits them ONLY inside @media (prefers-reduced-motion: no-preference) keyed on data-object-id; includeDataIds:false keeps them inline (fallback, never dropped); base reduce guard still neutralizes everything. Wired into exportToHtml, exportToReact (tokens.css), Studio preview. Unit 4/4.
- **Keyboard nudge (design.md 4.2):** arrows 4px, Shift 8px, 300ms coalescing into one /api/object-style op; typing targets inert; locked inert. Playwright 2/2.
- **Review loop (this session, every package re-read):** REAL defects fixed — schema GetSceneOutputSchema.locks wrong type; linter L-ALIGN dead rule (numeric strings never parsed); linter L-CONTRAST read color from the wrong place (never fired for real scenes); lock-port transient non-EEXIST write error instant-returned false (annotations.test.ts intermittent E_LOCKED 409 under full recursive-test load; now 3 retries w/ backoff; 2x pnpm -r test green); tokenToCssVar broke on dotted paths (token.color.text.primary -> var(--intent-color-text.primary); now hyphenated); React exporter re-pointed at the RenderModel (parallel scene walker deleted; goldens regenerated; no nested <main>; .intent-app height chain fix from Phase 13).
- **Flagged, not changed:** L-LOCK stays severity error (recorded contract + explicit test); output schemas GetSceneOutput*/GetFeedback* never parsed anywhere (dead-but-exported).
- Verify 12/12, unit 623/623, Playwright 95/95. M2 ~75%; M3 ~25% started.

## Phase 15 addendum (2026-11-17 — M3.A/Static complete, 4-pass review findings)

- **Design Profile to React/Tailwind (trd 13.7, b9a816a):** tailwind-map.ts (pure, PURE exact-match); underscore keys sanitize, dots become arbitrary-value classes; no match means CSS-var fallback preserved; `intent export --format react` auto-reads .intent/design-profile.json.
- **trd 21 budgets test-enforced:** flat valid 500-object scene; core normalize median <50ms; writePipeline p95 documented-hardware-gap (128-170ms CI host) with honest comment + owner TODO to tighten post-measurement on laptop hardware.
- **pipeline.ts:** verify-before-write re-read removed (redundant under scene lock; baseRevision is the drift gate).
- **tokenToCssVar:** dotted token paths now hyphenate (token.color.text.primary -> var(--intent-color-text-primary)); applied in style-decl.ts and icons.ts.
- **linter L-ALIGN:** numeric-string lefts ("100px") were never parsed; rule previously dead. **linter L-CONTRAST:** read color from the wrong place; now reads style.color/background with props fallback.
- **lock-port:** transient non-EEXIST write errors (Windows AV/indexer) no longer instant-fail writePipeline (3 retries with backoff) — annotations.test.ts intermittently failed the wrong PUT with 409 under full verify parallel load; now stable across 2x verify runs.
- **Axe full-tab coverage:** Interview/Profile/Feedback tabs, zero critical/serious (CSP-bypass harness).
- **S-3-00 re-plan** (docs/s3-00-replan.md) — executed; M3 ~ 70%; remaining is owner-gated release work.
- **RC:** axe/pipeline/bench + profile mapping landed AFTER the M1 gate waiver review cycle; M1 gate verdict unchanged (closed by owner waivers 2026-11-16).
- Unit 635/635; Playwright 98/98; verify 12/12 at b9a816a + this docs commit.

## Phase 16 addendum (2026-11-17/18 — LICENSE + security evidence + animation editor)

- **LICENSE: MIT (completely free for everyone)** added. Owner rules still hold: no tag/push/publish before 100/100; owner drives those calls.
- **Security evidence (this session):** trivy fs scan (pnpm-lock.yaml) = 0 vulnerabilities; pnpm audit = 0; nuclei (t1-headers, t2-exposure) = security headers present (CSP with 2 script sha256, nosniff, DENY, no-store, Referrer-Policy, COOP); sensitive files (/.git/config, /.env, /.intent/config.json) NOT 200-served. Evidence captured from local scan of the Studio; the repo has never been published.
- **Animation authoring UI (trd 13.6):** Inspector gains an "Animation" row — Property/Duration/Easing select; Apply to /api/object-style pipeline; Remove unsets via empty value (engine drops it). Playwright 1/1 new spec.
- **Axe full tab coverage** (Interview/Profile/Feedback) passes; profile tab added to matrix.
- **Files audit:** my own one-off test-ID migration helpers (fix_test_ids.mjs, fix_all_test_ids.mjs) deleted; .tmp cleanup done.
- Verify 12/12 (635/635 unit, Playwright 99/99).

## Phase 17 addendum (2026-11-18 — device frames + keyboard undo + MIT + security scan evidence)

- **LICENSE: MIT** — picked by owner directive (completely free for everyone); all 11 package.jsons carry the field; RC/plan/replan docs synced.
- **Security evidence run (local):** trivy fs (pnpm-lock.yaml) = 0 findings; pnpm audit = 1 high, ACCEPTED (picomatch ReDoS, dev-toolchain only via @typescript-eslint → tinyglobby → fdir, no patch available in registry, no remote-input path); nuclei (t1 headers / t2 sensitive exposure) = headers present, sensitive files not 200-served. Documented in docs/security.md.
- **Device frames (design.md 4.2):** Phone 375 / Tablet 834 / Desktop buttons in topbar; body classes .frame-* resize .iframe-wrap; aria-pressed group; Playwright 1/1.
- **Keyboard undo (Ctrl/Cmd+Z, design.md 4.7):** restores latest before-send snapshot (the feedback-based model's real undo = version restore, never rewrite history); Playwright 1/1.
- **Honest remaining (agent-doable):** full shadcn component-by-role import mapping in React export (trd 13.7 tail); animation keyframes authoring UI (today = simple transition setter); the 97% acceptance target needs a real agent session (never measured); Linux/macOS ACs unobserved; tag/push/publish = owner decision; watch mode = agent dependent.
- **Verify 12/12, unit 635/635, Playwright 101/101, audit 1 accepted-high (docs/security.md).**

## Phase 18 addendum (2026-11-18 — shadcn mapping end-to-end)

- **trd 13.7 shadcn half DONE:** scanner now fills profile.components from the aliased
  ui directory (.tsx/.jsx; button/input/textarea/checkbox/switch/radio-group/select/label/card/dialog),
  importPath uses the alias as-is (user tsconfig resolves it); exporter maps button/input roles to
  imported shadcn components with prop forwarding (variant from className suffix; required/disabled/placeholder
  passthrough; data-object-id flows for selection). No profile -> existing CSS-var output.
  2 e2e tests prove scan -> export pipeline.
- Verify 12/12; unit 637/637; Playwright 101/101. M2 ≈ 90%, M3 ≈ 80%.

## Phase 19 addendum (2026-11-18 — @keyframes authoring end-to-end)

- **trd 13.6 scene keyframes table:** `scene.metadata.keyframes` is schema-validated (closed grammars: name `^[A-Za-z_][A-Za-z0-9_-]{0,63}$`, offset `from|to|N%`, property kebab/custom, values ≤200 chars, 64 KB cap) — additive, defaults to `{}` so old scenes parse unchanged. Engine sanitizes again at render (`sanitizeKeyframes`, defense in depth). `renderAnimationCss` emits `@keyframes` INSIDE `@media (prefers-reduced-motion: no-preference)`, steps sorted (from<to, numeric offsets), names sorted — deterministic; keyframes emit even when `includeDataIds: false`; the `[data-object-id]` animation rules still require ids.
- **Server:** `GET/PUT /api/keyframes` (full-replace, `baseRevision` stale → 409 E_CONFLICT, scene revision bump + SSE broadcast — versions-restore precedent; scene-level so no object lock).
- **Studio:** Keyframes section in Inspector (add/delete keyframes, offset rows, declaration rows with CSS-prop datalist, per-card "Animate selected" → `animation: <name> 600ms ease infinite` via the /api/object-style pipeline); "Remove animation" in the Animation row. **Bugfix:** `.force-state-row` CSS block had lost its selector in 9ead598 (orphaned declarations, dead CSS) — selector restored.
- **Studio preview** carries the keyframes (includeDataIds=true path; React export carries them in tokens.css even with includeDataIds=false since anim declarations inline in JSX there).
- Tests: engine +3 (emission + sorted steps, value-sanitization drop, keyframes-without-ids), server +5 (GET/PUT/409 stale/400 out-of-grammar), Playwright +1 (`tests/keyframes-editor.spec.ts`: UI → storage → preview document chain). Verify 12/12; unit 645/645; Playwright 102/102.

## Phase 20 addendum (2026-11-18 — trd 9.4 file watcher with polling fallback → closes AQ1)

- **FileAdapter.watch was entirely missing** (M1 deliverable, trd 9.4, architecture 10.2). Implemented zero-dependency on built-in `fs.watch(..., { recursive: true })` (Node ≥ 20 on Linux/macOS/Windows — AQ1 resolution recorded; owner may swap in chokidar later).
- **adapters-node/src/watch.ts** — 50 ms trailing debounce per path (atomic tmp+rename fires twice), containment check, tmp/logs/node_modules/.git and `*.tmp-*` ignored; polling fallback (mtime+size every 1 000 ms, depth ≤6, ≤1000 files) engages when fs.watch fails to start OR errors at runtime; poller retries the fs watcher every ~5 s and upgrades in place; `onFallback` fires once ("Live updates are slower on this folder" notice).
- **server/src/watch-wiring.ts** — maps paths to the existing SSE broadcasts: `scenes/<id>.json` → revision broadcast (Studio refetches; idempotent); `interview/state.json` → `interview.changed`; `feedback/<id>.json` → `patch.changed`. Locks intentionally not broadcast (they surface via `/api/scene`'s `locked` field on the next revision-driven refetch — documented gap).
- **Studio** — `watch.degraded` SSE event shows a persistent dismissible notice with the exact trd wording; `.watch-notice[hidden]` guard added (flex override).
- Tests: adapter unit +5, server integration +1 (hand-edit scenes file → `revision` SSE event, TC-WRT-11 spirit). Verify 12/12, unit 651/651, Playwright 102/102.

## Phase 21 addendum (2026-11-18 — MCP output-schema enforcement, review flag cleared)

- The review-2026-11-16 flag "output schemas GetSceneOutput*/GetFeedback* never parsed anywhere (dead-but-exported)" is now **resolved**:
- **Schemas updated to the real wire contract** (they were stale): `GetSceneOutputSchema` gains `pendingPatches`, `metadata.profileSummary` (trd 17.1), `_truncated`/`message` optionals; `revision` optional (truncation-fallback payload carries none). `ApplyPatchOutputSchema` — `revision` and `conflict.currentRevision` are `min(-1)` ("revision unknown" sentinel from pipeline early-return paths; documented). `GetFeedbackOutputSchema` passed as-is.
- **Enforced in `handleMCPRequest`:** get_scene / apply_patch / get_feedback payloads are safeParse'd at the MCP boundary; a handler producing a payload its own output schema rejects throws `E_INTERNAL` with the first 5 issue paths only (never echoes scene data). Unknown tools unchanged; unlisted tools pass through unvalidated (e.g. `ask_user`, `validate`).
- **Core:** additive `E_INTERNAL` error code (no exhaustive switches on ErrorCodes exist).
- Tests: `packages/mcp-server/src/output-schemas.test.ts` +4 (anti-strip of profileSummary/pendingPatches, subset shape, get_feedback contract keys, stale-apply_patch does not trip the validator). Verify 12/12, unit 655/655, Playwright 102/102.

## Phase 22 addendum (2026-11-18 — shadcn mapping correctness fix)

- **Regression fixed (self-found, from 6ef9cc9):** the trd 13.7 shadcn mapping keyed only on `node.tag === "input"`, so the model's *synthesized* checkbox/radio/switch inner inputs (id `<parent>::input`, native checkboxes/radios) became the text-oriented shadcn `<Input>` — silently dropping `checked` and control semantics. Now excluded via `isSynthesizedControlInput` (id suffix `::input|::track`, type checkbox|radio, or role=switch); scene-level text-entry inputs still map.
- Non-mechanical roles are **explicitly unmapped and documented** in `shadcn-map.ts`: checkbox/switch/radio-group (controlled-component subtree replacement), select/card (no model tag), dialog (composed trigger/content pair), textarea (no textarea object type in the scene schema).
- E2E fixture locks the regression (native checkbox in export; no `<Input type="checkbox">`). Verify 12/12, unit 655/655, Playwright 102/102.

## Phase 23 addendum (2026-11-18 — test.md gap audit: TC-MIG + interview metrics; scene-lock race fix)

Audit of docs/test.md (204 spec IDs) against the codebase found two genuinely missing M1/M3 deliverables; everything else is covered or owner-gated. Plus a REAL concurrency defect found by the suite and fixed at the root.

1. **TC-MIG-02/03/04 — document version handling.** New `core/src/migrations.ts`: `checkDocumentVersion` (newer document -> `E_VERSION`, file NEVER modified), `registerMigration`/`applyMigrations` (in-memory upgrade on read; migrated form written only on the next accepted write; reading never writes; a non-advancing migration fails loudly with E_VERSION). Wired into EVERY storage read path in adapters-node and the core in-memory test port (scene, locks, config, profile, intent-profile, interview state, brief, annotations). MIG-04: fake v1->v2 migration proves the mechanism in `core/src/migrations.test.ts`; MIG-02/03 proven at adapter level. No real migrations exist yet (zod defaults carry v1 forward).
2. **intent.md §12 — `.intent/metrics.json` (gitignored) + interview efficiency report.** Schema `InterviewMetricsSchema` (strict; **spec deviation, change-logged**: `harvested`/`prefilledConfirmed`/`prefilledChanged` OMITTED on the current contract — they require the proposed-but-unapplied I1/I5 amendments; `delegated`/`skipped` collected from the agent-supplied `previousAnswer.delegated|skipped` opt-in markers; `asked`/`answered`/`prefilledShown`/`serverCaps`/`summaryChoices`/`finalPercent`/`abandoned` derived deterministically at answer time). `core/src/interview-metrics.ts`: recorder (session opens on kind:start/lazily, closes on summary exactly-right with finalPercent = capped meter, incomplete session marked abandoned on a new start, last 50 sessions, telemetry never breaks the interview) + pure `summarizeInterviewMetrics` (TC-MET-04 fixture test; delegateRate/prefillAcceptance are null when no session collected the data — never faked). Wired into BOTH answer paths: ask_user (mcp-server) and Studio (api-routes). `GET /api/interview-metrics`; Studio gains an **Interview efficiency** section (sessions, avg asked, delegate rate, prefill acceptance, first-summary approval share — locally computed, never sent anywhere).
3. **REAL DEFECT FIXED (root cause):** intermittent "4 procs on DIFFERENT objects" failure (final revision 3 instead of 4 — a lost update) traced to `acquireSceneLock`'s stale check treating ANY readFile/parse failure as torn content -> a LIVE scene lock could be quarantined and unlinked -> two writers in the critical section. Fix: transient errors now retry 25/50/75 ms, then mean "live owner, wait" (never reclaim); ENOENT/persistent parse failure is "torn" by design; rename-back after quarantine happens only when the slot is free (Node rename on Windows replaces existing files — blindly renaming back would clobber a third owner). Worker retry budget widened 50 -> 150 (assertions unchanged). 8/8 clean multi-process runs; mutation proof anchor updated to the refactored scene-read path (5/5 DETECTED).
4. Per the same audit, spec'd-but-unowned final-match figure (TC-MET-03) needs the TS1 ruling (owner); interview simulator (M1 "interview simulator" line) needs a scripted-agent harness decision — not built, honestly recorded here as not done.
- verify 12/12, unit 674/674, mutation proof 5/5, Playwright 102/102.

## Phase 24 addendum (2026-11-18 — interview simulator + chat-approval completion)

- **intent.md M1 "Interview simulator" implemented:** `packages/mcp-server/src/interview-simulator.test.ts` — a scripted agent drives a full interview against the real `ask_user` handler and real storage. Asserts: start → question → summary → exactly-right approval flips status to complete and closes the metrics session with `finalPercent` (three-layer integration); meter cap at 89 with an uncovered required topic and uncap when it becomes covered; summary ask-more keeps the interview open; delegated answer markers counted.
- **Real defect found by the simulator and fixed:** a chat "exactly-right" answer to a summary question never flipped interview status to `complete` (only the Studio path did) — chat-approved interviews stayed `in_progress` forever, so the interview never ended and their metrics sessions were never closed. Now `answeredKind === "summary" && summaryChoice === "exactly-right"` flips status complete (mirrors `handleApiInterviewAnswer`).
- verify 12/12, unit 677/677, mutation proof 5/5, Playwright 102/102.

## Phase 25 addendum (2026-11-18 — FIRST push; Linux/macOS CI observed; linter profile-aware; README honest)

- **First push ever:** `origin/main` `1e863d2..a4da92a` (90 commits including CI fix), fast-forward, no force. Repo `BilalAjmad/intent-communication` is PUBLIC; default branch left untouched (`work/wip-s-1-01-to-06`). Tracked-file secret scan: clean; LICENSE MIT at root.
- **CI run 44368167556 FAILED** at `pnpm --filter @intent/server build` (TS2307: `@intent/studio` types not built yet) — the workflow had never actually run before; only Windows evidence existed. Root cause: the matrix built server BEFORE studio although server imports studio's `buildPreviewDocument`/`previewScriptHashes`. Fix (`050bcb9`): topological order schema→core→linter→adapters-node→engine→mcp-server→skills→studio→server→cli. Windows/macOS jobs were cancelled by fail-fast that run.
- **CI run 44369132170:** test matrix GREEN on ubuntu/macos/windows. e2e failed two Linux-only defects: (1) `react-export.spec.ts` execFileSync(node, [esbuild/bin/esbuild]) — under pnpm on Linux the bin is a shell script → SyntaxError; fixed via esbuild JS API (`buildSync`). (2) `nudge-keys.spec.ts` — arrow keys dropped because the preview iframe hadn't published `state.lastRects` yet; test now waits for `.selection-box` (assertions unchanged). Fix committed as `707ae20`.
- **CI run 44371953296: SUCCESS** — first fully green CI observation on Linux + macOS + Windows (install→build→typecheck→test, Playwright e2e on Ubuntu). Node-20 deprecation annotations from GitHub (actions forced onto Node 24 runtime) are warnings, not failures — noted for a future action-version bump (owner decision).
- **Linter is profile-aware now (S-3-00 re-plan item, trd 16):** L-TOKEN suggests the NEAREST design-profile token (squared RGB distance) as `suggestion` ("Use token.color.primary (#2563eb)"); L-CONTRAST resolves the profile's hex color tokens merged over the built-in reference palette (profile wins) — real contrast pairs verified; `/api/lint` reads `.intent/design-profile.json` (tolerant parse; context-free fallback). `LintProfile` optional param added to `lintScene(scene, locks, profile?)`. Tests +6 (5 linter + 1 lint-api). verify 12/12, unit 683/683.
- **README rewritten to current reality** and the 5-minute quickstart re-executed end-to-end: `intent init` → `intent doctor` → `intent export` — all pass; export emits valid HTML + CSP; CLI prints honest "not enough data yet — no first-render baseline" acceptance line (correct by design).
- **npm publish-readiness (read-only scan):** 10 packages @ 0.1.0, MIT everywhere, no `files` arrays, no `prepublishOnly`, `npm whoami` → ENEEDAUTH on this machine — publishing requires owner login + owner decision; tag/release remain owner-only (R-B33, PL-10).
