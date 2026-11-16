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

## Phase 10 addendum (2026-11-16 — zod 4 + M2.A build-out)
- zod 3.25.76 → ^4.6.7 (a0427d6) — GHSA-mrhx-c7xc-m3w5 closed; tools/list inputSchema via z.toJSONSchema(..., { io: "input" }); audit 19→18, all dev/test toolchain; verify 12/12.
- M2.A, in commit order: (fb12e18) 8 object types + shared allowlisted inline-SVG icon module; (33b06cb) ReactExporter basic + `intent export --format react` + html export missing-await fix; (4999b6d) states end to end — schema strict StateOverride, renderStateCss pseudo/data-state attribute selectors, preview forceState runtime; (51e5360) responsive overrides — strict sm/md/lg overrides, renderResponsiveCss @media blocks, breakpoints wired via config.json into `intent export`; (b30d653) components & instances — render-time deterministic expansion, derived `<inst>::<inner>` ids, override precedence, nested instances; (76ab9b9) annotations — schema/storage/server API (create/list/image/delete, PNG magic bytes + IHDR, 1 MB caps, 0600 files), get_feedback annotations with includeImageData first-3 cap, patch→send flips open→sent.
- Deviations (recorded): no 13.1/13.2 RenderModel — exporters render directly from the scene; props/text state overrides are not rendered as CSS; Studio pencil/pin canvas + Inspector + drag/resize (M2.C) unbuilt; S-2-00 re-plan not run (user direct instruction).
- Verify 12/12, unit 529/529, Playwright 77/77. M2 ≈ 35%. M1 gate still NOT READY (AC-M1-11, AC-M1-13, CI unobserved). Whole project honestly ≈ 40%.
