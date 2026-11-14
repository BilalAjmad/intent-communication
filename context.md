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
