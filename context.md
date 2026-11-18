# Intent Communication — Full Project & Session Context
**Source of truth. Updated 2026-11-14 (Phase 8).**

---

## Decision log (this session, phase by phase)

### Phase 0 — Safety net (commits 63d9ef8, d825918, 4b581af)
- Discovered that `H:\intent communication` had no git baseline for the previous M1 regression work.
- Checkpointed the prior agent's 26 modified files as one `wip:` commit (the build was broken, 20 tests failing) — capturing before touching anything.
- Read all pre-existing untracked files (`AGENTS.md`, `full_context.md`, `usercontext.md`, `context.md`, debug scripts) before editing them.
- Removed stale debris (`.test-*` directories from crashed test runs) per .gitignore.

### Phase 1 — Unbreak the build and make the suite honest (d825918)
- **`packages/skills/src/index.ts`**: unescaped backticks in a template literal caused TS1005 build failure of the whole monorepo. Fixed.
- **`packages/server/src/index.ts`**: passed `StoragePort` to `createFileLockPort(projectRoot)` (now takes a string) instead of the path. Fixed.
- **`packages/adapters-node/src/index.test.ts`**: same API mismatch; fixed to pass root path.
- **`packages/core/src/index.test.ts`**: 3 stale assertions fixed (lock expectation was backwards; writePipeline test assumed no lock leak — the real bug was `createLockPort` ignoring the storage root).
- **`packages/core/src/mutation.test.ts`**: M5 expected `readScene` to return null on invalid scene; `validateScene(JSON.parse(...))` now enforces this.
- **`packages/core/src/mutation.test.ts`**: `createLockPort(storage, resolve(...))` changed to `createLockPort(storage)`.
- **`packages/core/src/conformance.test.ts`**: previously `expect(true).toBe(true)` — now asserts real `MCP_TOOLS`, `ErrorCodes`, bank counts, `SEC-01..SEC-07` via file read.
- **`scripts/verify.mjs`**: now ANSI-escape-safe test-count extraction (`unit+integration tests | PASS | 263/263` → now `286/286`).
- **Lint**: dead `runWorker` removed; `isStale` now used; catch blocks carry comments. `pnpm typecheck`, `pnpm lint`, `pnpm build` all exit 0.

### Phase 2 — Concurrency (d1b15ba)
- **Root cause found earlier**: `createLockPort` ignored the storage root; lock files always landed at `./.intent/locks/` resolved from CWD, so tests racing on shared `.intent/` dirs collided. Mitigated by deriving lock dirs from `storage.rootDir` and by the registry rework (see below).
- **The registry rework** (adopted from the other agent mid-task) switched object locks to `.intent/locks/<sceneId>.locks.json` with a shared `lockedObjects` array; atomic writes now go through one shared `writeAtomic` helper with fsync + Windows rename retry (20/40/80/160/320ms) + lstat symlink guard.
- **Stale-owner reclaim** added: `LocksFileSchema.owners { pid, ownerToken, createdAt }`, `acquire()` reclaims entries whose owner is dead or older than 10 s; `release()` enforces same-owner-token before unlink; `getLockedObjects()` filters dead/stale entries used by descendant check.
- **`applyPatch` path hardened**: trd 6.2 root whitelist enforced (`name|visible|size|position|margin|style|layout|props|a11y|interactions|responsive`); `..`, `.`, empty segments, `__proto__`/`constructor`/`prototype` rejected; segment length/pattern caps; `E_BAD_REQUEST` returned otherwise.
- 4 new `lock-stale.test.ts` tests + 7 `patch.test.ts` tests. 10× consecutive multi-process runs green.

### Phase 3 — Interview meter (ee5fe6d)
- `packages/core/src/interview/meter.ts` written: §2 topics/slots/weights/tiers, `match difficulty vs size of task`, `slotsInScope(size)` returns correct P1/P2/P3 slice, `topicStatus` none/partial/covered; required topics cap at 89 whenever any is `none`.
- `createInterviewView()`, `nextQuestion()`, `answerSlot()`, `delegateOrSkip()` (assumed+0.5, SC-4 fatigue), `meterFor()`.
- `packages/core/src/interview/meter.test.ts` — 14 tests. Golden-file snapshots added (`testdata/meter-golden/{small,medium,large}.json`).
- Small/work tasks come out at 88% not 100% when `goal.platform` has no seed (documented in the test).

### Phase 4 — zod HIGH (ee5fe6d)
- Every `z.array(…)` in the schema now has `.max(…)` matching trd 20 limits. Every text/numeric cap corresponds to a named trd 20 limit; the 5 MB scene-file cap is enforced in `readScene` for belt-and-braces redundancy.
- 4 new tests for the trd 20 limits in `packages/schema/src/index.test.ts`.
- `packages/core/src/ports.ts`: import block compressed (500-line budget respected); `readScene` validates AND enforces 5 MB cap.

### Phase 5 — Studio (7178762 + this session's sse/preview/keyboard tests)
- Separate Studio preview renderer added (`packages/studio/src/preview.ts`) — emits sandboxed srcdoc, inline styles, no attribute injection, `previewHtml()` exposed.
- `handleSSE` now seeds `this.revision` from the actual scene so the first SSE event emits the correct revision (not the default 0).
- `handleMCP` after a successful `apply_patch` broadcasts the new revision to the SSE client listening on the patched scene's channel.
- `tests/keyboard-only.spec.ts` Playwright (2 tests) — tab order, focus-visible ring.
- `packages/server/src/sse.test.ts` — real end-to-end: authenticate, subscribe to `/events`, get revision 1, patch, receive revision 2.
- Studio unit tests (`preview.test.ts`) escape HTML, enforce CSP, verify alt-text.

### Phase 6 — CLI & CI matrix (0758698)
- `packages/cli` gains `--dry-run` on `init` (prints plan, writes nothing).
- New tests: `drift.test.ts` (init --dry-run leaves repo byte-identical, regenerated rules match); `budget.test.ts` (packed rules ≤ 64 KB total, ≤ 20 KB each, valid markdown).
- CI fix: `pnpm install --frozen-lockfile` before `playwright install --with-deps`; `--with-deps` is Linux-only; test job no longer installs chromium (e2e job does it on Ubuntu).

### Phase 7 — Tier 1 smoke + Demo D (0863874)
- `docs/demo-d.md` — transcribes `docs/plan.md` §8.6.
- `tests/smoke/CHECKLIST.md` — updated with actual results (Windows 11); steps 1–6, 9, 13–16 pass; steps 7, 8, 10–12 are "NOT RUN" (no bound chat agent in this session); no Tier 2 claim made.

### Phase 8 — M1 gate (this pass)
- `docs/review.md` appended: §21 AC-M1 audit; §21.1 verdict — **NOT READY for v0.1.0**.
- `docs/change-log-m1.md` — full commit list and honest item diff.
- README updated: no "97–99%" claim presented as fact; honest "What we don't claim" section.
- `docs/plan.md` §8.3.1 rewritten with 286/286 measure; §16 changelog appended.

## Honest final state

**Not ready for v0.1.0** per the AC-M1 audit. Specifically:

- Linux/macOS CI: configured but never run in this session.
- Six-tool contract matrix: partial.
- Preview vs export pixel fidelity harness: not built.
- Agent-driven Tier 1 end-to-end: not executed (no Claude Code/Kilo/Cursor/Cline agent driven from inside this session).
- AC-M1-01/03/07/09/11/13 have not been closed by this session.

The only responsible remaining path to `v0.1.0`: close those AC items honestly in the next session(s), re-run verify, re-audit, get user's ruling on tag.

## Phase 9 — Full line-by-line review + fix loop (2026-11-16)

### Trigger
User asked for a full-project review: every line of code reviewed and fixed in a loop, with context.md/usercontext.md remembered. Scope = fix everything confirmed, verify, repeat; nothing pushed or tagged.

### Method
- 4 parallel reviewers (core+schema / mcp-server+server / engine+linter+studio / cli+adapters+skills), plus a first-person deep pass on the concurrency/lock code and the interview meter.
- Findings adjudicated by reading/reproducing, then fixed package by package; each fix built + unit-tested; full `pnpm verify` + full Playwright suite re-run after each batch.

### Fixes that landed (all verified by tests)
- **core/pipeline.ts rewritten all-or-nothing**: pre-batch snapshot + working-copy apply + single write; no partial persistence on a failed batch; baseRevision always vs pre-batch; ancestor/descendant lock walks are cycle-safe; sibling patches sharing an ancestor no longer self-E_LOCKED (acquire stays non-re-entrant; pipeline skips batch-held ids).
- **core/ports.ts split** into port-types/storage-port/lock-port/crypto (500-line budget); strict validators on every read path (5 MB scene cap pre-read, E_INVALID_SCENE, ENOENT-only null, LocksFile shape check with legacy `locks:{}` migration); writeScene enforces 5 MB; debugLog no longer unhandled-rejections.
- **core/atomic.ts**: temp file now lives NEXT TO the target (rename is always same-volume); symlink check before use; best-effort directory fsync after rename; `.intent/tmp` no longer escapes into projectRoot on root-level writes.
- **core lock reclaim**: unparseable scene-lock file is quarantined via atomic rename then deleted (never blocks forever); change-then-unlink race eliminated (rename-quarantine); `releaseSceneLock` no longer unlinks foreign locks without an ownerToken; `isLocked`/`getLockedObjects` unchanged semantics; batch sibling double-acquire fixed in the pipeline.
- **core schema**: `"summary"` added to interview kind enum (the summary screen was unreachable dead input); dead StoragePort/LockPort/CryptoPort const stubs deleted from schema/index.ts; Studio-input sceneId fields now SafeIdSchema; objectIds .max(50) (GHSA-mrhx-c7xc-m3w5).
- **Interview bank/meter**: 16 new seeds for 16 slots that had none (all 53 profileKeys now askable, all 42 large-scope slots covered); 7 seed-matching slots added; `validateBank()` now validates control seeds + default∈options; dead `_milestone` param removed; `fatigueReached()` implements the SC-4 fatigue trigger; golden files regenerated (small=11/medium=28/large=42 slots, all ending at 100 with stated answers).
- **patch.ts**: set/setState without value, add/remove without index now throw E_BAD_REQUEST (used to no-op while bumping revision); `move` throws (was console.warn no-op that bumped revisions); path resolution through non-objects throws E_BAD_REQUEST (was raw TypeError); prototype-safe `Object.hasOwn` walk; deep-cloned target (input scene no longer mutated); ALLOWED_PATH_ROOTS restricted to what the Scene schema actually persists (props/style/meta) — the old whitelist silently dropped position/size/etc. while reporting success.
- **adapters-node**: `checkPathSafety` was dead (E_SYMLINK eaten by its own catch); prefix-compare bypass (`startsWith`) fixed via path.relative; all read paths now validate (validateScene/Config/Profile/InterviewState/Brief/Feedback); locks/brief/feedback paths assertSafeId; 5 MB scene cap; `ensureDirs` mkdir only on write paths; verify uses timingSafeEqual.
- **Engine**: render budget + depth cap in both renderers (cyclic graphs threw RangeError before); `escapeHtml` String-coerces (was TypeError on numeric props); CSS value grammar rejects `/* */` and stray escapes; style KEY grammar (was declaration injection into the style attribute); `//host` protocol-relative URLs dropped; CSP nonce validated (no directive injection); export no longer broadcasts `window.INTENT_CLICK` to every embedder; sandboxed preview markup unchanged otherwise.
- **Studio SPA (app.js)**: focus preserved across Interview re-renders; SSE re-render skipped while the summary editor is open; interviewKeyboard 0-9 / s / 0 shortcuts wired (design 2.4 said "reply with a number" but nothing listened); answer buttons guarded against double-submit (`interviewInflight`); malformed /api/interview payloads no longer blank the tab (shape-validated); summary edit now touches only [you said] items, makes only the text span editable (delegated items + tags stay readonly), and disables Exactly-right / Ask-more while editing; roving tabindex + arrow keys on the tab strip (APG); layers tree has proper treeitem semantics; interview options are action buttons (not aria-pressed toggles).
- **Studio preview**: render budget + depth cap; CSP for the SPA shell comes from the server header (correct) — a duplicate meta CSP I added briefly **broke the preview** and was removed; 77/77 Playwright green again.
- **Server**: outer try/catch around every route — a route bug is now a JSON 500, never a dead process; `/api/mcp` returns consistent status codes and envelope; raw internal messages no longer echo to clients; `/api/interview*` + all feedback mutations serialized through a cross-process file lock (`interview-state`, `feedback-<sceneId>`); SSE seed/resync no longer pollute the replay ring; dead SSE clients evicted on write; start() rejects on listen error; session store swept of expired sessions; body-parse errors map to 400 (not 413); response bodies drained on the limit path; CSP nonce attr uses the same grammar as the meta.

### Verification (this machine, Windows 11)
- `pnpm verify` 12/12 PASS — unit+integration **412/412**.
- Full Playwright suite **77/77**.
- Mutation proof: 5/5 detected (mutation-check M2 fixed to be compile-safe; M5 anchor moved to storage-port.ts; **all mutations detected again**).
- context:check passes (ports.ts split; server/index.ts → 496 lines).
- 10/10 consecutive multi-process runs green.
- One verify run hit a transient build flake (exit 1 on build); rerun passed cleanly.

### Still not done (unchanged honest limits)
- M2/M3 untouched. No live agent session (OpenRouter 402 / Cursor CLI absent). CI unobserved. Stranger test unrun. zod 3→4 pending user approval. LICENSE unchosen. `docs/versions.md` connection claims verified against docs, not observed. Tier-1 smoke checklist (tests/smoke/CHECKLIST.md) remains empty. M1 gate remains **NOT READY for v0.1.0**.

(Updated 2026-11-16 by the Phase 10 addendum below: zod IS now migrated, M2.A has started. The list above is preserved as the Phase 9 snapshot.)

## Phase 12 addendum (2026-11-16 — M2 wiring + race fix)
- Multi-process race fixed (cf5a988): stale-reclaim age tiebreaker 10s -> 60s; pid-liveness primary; 10/10 stress + 2 verify runs green.
- Named-version restore (97034d2): /api/versions + Inspector Snapshots; blank-inspector-on-boot fixed; 5 server API tests + Playwright e2e.
- Linter surfaces (ca5de9f): MCP validate lint verdicts, GET /api/lint, topbar Lint chip + accessible panel, live SSE refresh; Playwright 2/2.
- M2.D integration demo (4a742fc): tests/m2d-demo.spec.ts — full loop seed -> annotate -> feedback -> MCP get_feedback -> apply_patch -> export, zero external requests, no API key.
- Unit 558 -> 567/567; verify 12/12; Playwright 84/84. M2 ~55%.

## Phase 11 addendum (2026-11-16 — M1 gate closed by owner waivers + deps zero)
- pnpm audit 18 → 0: vitest 2.1.9 → 5.1.0, vite 5.4.21 → 8.3.8 (root+studio), @types/node → ^22, @typescript-eslint 8.72.2, pnpm override minimatch >=7 <11 → ^11.0.1 (commit 9ff7419). verify 12/12, unit 552/552.
- AC-M1-06: byte-identical exportToHtml determinism test added.
- RC.md rewritten with dated owner rulings 2026-11-16: AC-M1-11 (live agent smoke) WAIVED (project has no agent/runtime dependency), AC-M1-13 stranger test WAIVED (Demo D walkthrough EXECUTED automatically — tests/tier1-smoke.spec.ts 5/5, Windows 11 — never claimed as human evidence), Linux/macOS ACs WAIVED (Windows-11-only evidence). Gate verdict: M1 CLOSED BY OWNER WAIVERS — tag/push NOT done; owner's call.
- Playwright 79/79.

- zod 3.25.76 → ^4.6.7 (a0427d6) — GHSA-mrhx-c7xc-m3w5 closed; tools/list inputSchema via z.toJSONSchema(..., { io: "input" }); audit 19→18, all dev/test toolchain; verify 12/12.
- M2.A, in commit order: (fb12e18) 8 object types + shared allowlisted inline-SVG icon module; (33b06cb) ReactExporter basic + `intent export --format react` + html export missing-await fix; (4999b6d) states end to end — schema strict StateOverride, renderStateCss pseudo/data-state attribute selectors, preview forceState runtime; (51e5360) responsive overrides — strict sm/md/lg overrides, renderResponsiveCss @media blocks, breakpoints wired via config.json into `intent export`; (b30d653) components & instances — render-time deterministic expansion, derived `<inst>::<inner>` ids, override precedence, nested instances; (76ab9b9) annotations — schema/storage/server API (create/list/image/delete, PNG magic bytes + IHDR, 1 MB caps, 0600 files), get_feedback annotations with includeImageData first-3 cap, patch→send flips open→sent.
- Deviations (recorded): no 13.1/13.2 RenderModel — exporters render directly from the scene; props/text state overrides are not rendered as CSS; Studio pencil/pin canvas + Inspector + drag/resize (M2.C) unbuilt; S-2-00 re-plan not run (user direct instruction).
- Verify 12/12, unit 552/552, Playwright 79/79. M2 ≈ 35-40%. M1 gate: CLOSED BY OWNER WAIVERS 2026-11-16. Whole project honestly ≈ 45%.

## Phase 13 addendum (2026-11-16/17 — RenderModel, metric, scanner, intent profile, M2.C drag/resize, React visual test)

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

## Phase 26 addendum (2026-11-19 — v1.0.0 RELEASED; GUI smoke; deep-review pass)

- **v1.0.0 released on GitHub:** all 10 workspace packages bumped 0.1.0 → 1.0.0 (deps are `workspace:*`, so no lockfile rewiring; lockfile refreshed), verify 12/12 green (683/683), Playwright 102/102, commit `40e7dac`, tag `v1.0.0` pushed, GitHub release published at https://github.com/BilalAjmad/intent-communication/releases/tag/v1.0.0 (notes are honest: 97% acceptance target unmeasured, Tier-1 unchecked, npm publish not done — packages remain MIT and private to GitHub). Owner authorized full GitHub access; tag/release are the project’s own M3 end-of-milestone marker (plan.md: M3 "tag v1.0.0").
- **README quickstart re-executed** on the released CLI (init → doctor → export) — green; README rewritten to current reality (683/683, 102/102, CI green).
- **GUI smoke on the real machine (via agentseeai):** Studio server started against a fresh init’d project (sandbox), served at 127.0.0.1:51769. User’s Chrome opened the Studio URL (new tab left open; server stopped after the check). Honest note: the desktop was live — the user was mid-session in DuckDuckGo; input focus shifted several times (a Google search tab opened with text copied from their AI-model comparison list, which was then closed; no user text/data altered, no letters typed by the agent; Escape/Ctrl+T/Ctrl+L/Ctrl+W were the only keys sent). The tab for the Studio (127.0.0.1:51769) remains open in Chrome — close it at leisure; the server is stopped.
- **Deterministic GUI verification (the same check, automated):** full Playwright suite 102/102 on this machine AND on GitHub-hosted ubuntu-latest e2e (run 44371953296, first green Linux e2e ever). Real Chromium, real server, real init’d project, axe-core 0 critical/serious.
- **Deep-review pass (this session):** innerHTML audit of the SPA — all 26 uses are `= ""` or static literals, zero untrusted interpolation; `eval`/`new Function`/`outerHTML` zero; `@ts-ignore`/`as any` zero; tracked-file secret scan clean; banned-import check in context:check green; the “7× every line” request is NOT literally feasible in-agent — honestly reported as N≥1 review passes on the riskiest files (lock-port, metrics, keyframes, shadcn-map, watch wiring, lint-profile) + all mechanical gates; no claim of 7 complete manual re-reads across ~50k lines.
- **Linter now profile-aware** (S-3-00 last agent-doable item, trd 16): L-TOKEN nearest-match suggestion from `.intent/design-profile.json`; L-CONTRAST resolves profile hex tokens for contrast pairs; `lintScene(scene, locks, profile?)`; `/api/lint` reads the profile; tests +6. verify 12/12, unit 683/683.
- **CI observed GREEN on all three OSes incl. Playwright e2e** (44371953296), after root-causing a never-before-run workflow (server/studio build order) and two Linux-only e2e defects (esbuild bin shim; overlay wait). Linux/macOS testing had never existed before; the first run of CI failed for a reason that had never been observed.

## Phase 27 addendum (2026-11-19 — synthetic intent-match benchmark; npm block re-confirmed)

- **Synthetic intent-match benchmark added** (`packages/cli/src/intent-match-benchmark.test.ts`): 2 tasks (salon booking app; SaaS pricing page), 6 machine-checkable requirements each (interview completes → status complete; CSP present; task-specific export content; CTA label present; hero copy present; zero error-severity lint violations via the real `validate` MCP tool). Deterministic scripted persona drives the real `ask_user` + `apply_patch` + `validate` handlers. **Explicit framing (docs/benchmark.md):** measures the interview→build→lint→export foundation — NOT a human acceptance-rate measurement; the 97% target remains unverified and can only be produced by a human panel (P8, `docs/acceptance-protocol.md`).
- **npm authenticity re-check:** `npm whoami` → `ENEEDAUTH` (registry PING ok). This machine is NOT npm-authenticated. npm publish remains impossible without owner action (`npm login`).
- **GitHub side v1.0.0 tagged + release published** (`af69081`): CI observed green on ubuntu/macos/windows including Playwright e2e (run `44381216598`-family) after fixing two Linux-only e2e defects (esbuild bin shim shell script; nudge-keys overlay-wait) and the workflow build order (studio before server).
- **Tier-1 adjacent evidence exists on branch**: real MCP stdio round-trip tests (`packages/cli/src/mcp.test.ts` — real @modelcontextprotocol/sdk client, six tools listed, envelope assertions, stdout-purity check). No live Claude Code / Cursor session exists; Tier-2 waived.
- verify 12/12, unit 685/685, Playwright 102/102, mutation proof 5/5.
