# Full Context — 100/100, Zero Context Loss

**Source**: `H:\intent communication` workspace + this session  
**Strictness**: 100/100 full context, strictly 0 context loss  
**Purpose**: Complete project snapshot for hand-off or reference, no information omitted

---

## Repo Layout & Current Git State

- **Path**: `H:\intent communication`; git repo, working dir = `H:\intent communication`, workspace root = `H:\`
- **Branch**: `main`, HEAD = `9b98664` — `chore: migrate test IDs to Crockford ULID format and clean up imports`
- **Remote**: `origin/work/wip-s-1-01-to-06` (M1 implementation commits; tip `7ac64b1` "fix: schemas.ts order, primitives.ts color parsing, test restored"; reference commit for the "169 tests" baseline is `8750f2e0`)
- **Working tree state**: **The entire M1 regression pass is UNCOMMITTED (working tree only)** — `git diff HEAD` = ~869 insertions / ~1480 deletions across 26 files. Nothing in the working tree is staged/committed.
- **Test count**: `it(` test count = 203 (includes 5 mutation tests). Server test contains named tests `SEC-01..SEC-07`.
- **Toolchain**: Node 22, `pnpm`, Vitest v2.1.9, Playwright, tsc (ES2022 / ESNext modules)
- **Packages**: `schema`, `core`, `linter`, `adapters-node`, `engine`, `mcp-server`, `server` (studio), `studio` (shell/preview), `skills`, `cli`, plus `scripts/` and `tests/`

---

## Project Nature & Lifecycle State

- **"Intent"** = a plan-driven, document-first build. Docs live in `docs/`: `plan.md` (draft v0.2), memory, versions, USAGE, INDEX.
- **Phase 0 documents**: (13 docs) complete; Reconciliation Pass (Step R) marked DONE in `docs/plan.md`; user said "start M1".
- **S-1 Step Status table** (from `pnpm verify` evidence, section 8.3.1 of `docs/plan.md`):
  - S-1-01 schema — Done-local (builds/typechecks/lints; 31 tests; Crockford ULID ID regex per trd 3.1)
  - S-1-02 core logic (pure) — Done-local (51 tests incl. write pipeline, locks, conflict, multi-process)
  - S-1-03 linter M1 — Done-local (17 tests incl. L-SCHEMA, L-GRID, L-CONTRAST, L-TOUCH, L-LOCK)
  - S-1-04 adapters-node — Done-local (16 tests)
  - S-1-05 core write pipeline — Done-local (all 51 core tests)
  - S-1-06 interview bank and meter — **Partial** (`packages/core/src/interview/bank.ts` exists with seeds from intent.md 6.3-6.5; meter not implemented)
  - S-1-07 mcp-server — Done-local (16 tests; six MCP tools exposed)
  - S-1-08 engine and HtmlExporter — Done-local (17 tests; HTML export with escaping + URL allowlist)
  - S-1-09 skills and cli — Done-local (CLI `init`/`doctor`/`export`)
  - S-1-10 studio server — Done-local (11 tests incl. SEC-01..SEC-07)
  - S-1-11 studio shell and preview — **Partial** (preview renderer is `exportToHtml` in iframe; no separate React renderer)
  - S-1-12 feedback flow — **Partial** (Studio has Feedback tab; SSE status updates not yet implemented)
  - S-1-13 fidelity test — Not started (no separate preview renderer; visual-diff test compares baseline vs mutations, 6 tests pass; threshold-0px test needs the renderer)
  - S-1-14 end-to-end demo and smoke — Not started (demo D script not written; `tests/smoke/CHECKLIST.md` empty)
  - S-1-15 M1 gate — Not started (gate checklist in 8.7 not executed)

---

## Current Session Objective (M1 Release Candidate regression pass)

- **Objective**: repair regressions vs docs, update `verify`/mutation proof, document readiness, produce the verify table + S-1 status table. **No new features.**
- **Alongside**: fix the flaky multi-process tests and the `E_LOCKED` issue raised by the object-lock rewrite (R-B1/R-B2/R-B3).

---

## Changes Introduced in the Working Tree (what the prior agent did)

- **R-B1** — Removed `force` and all baseRevision/conflict skip paths; per-object `.lock` files removed; replaced with trd 9.2 scene lock + per-object rev conflicts (trd 6.3) returning `E_CONFLICT` + `details.changedObjectIds`.
- **R-B2** — `L-LOCK` = object IDs only, stored in `.intent/locks.json`; scene lock via `.intent/tmp/<sceneId>.lock` carrying `ownerToken`, 12 attempts, 10s stale, pid-liveness reclaim using Windows PowerShell `Get-Process -Id`.
- **R-B3** — Atomic write already exists in `packages/adapters-node` (tmp file + `fs.rename`).
- **R-B4** — `scripts/mutation-check.mjs` updated to count failures from Vitest JSON output and restore mutated source in a `finally` block.
- **S-1 lock port rewrite** — `packages/core/src/ports.ts` restructured: `createLockPort` now uses the `tmpDir` for the scene lock; `acquireSceneLock` / `releaseSceneLock` added; `isProcessAlive` helper (PowerShell on win32, `process.kill(pid, 0)` otherwise); 10s stale reclaim; per-object locks in `.intent/locks/<sceneId>.locks.json` (`lockedObjects` array of object IDs).
- **verify.mjs** (`scripts/verify.mjs`, new — 146 lines) — full verify suite: install, build, typecheck, lint, unit+integration tests, multi-process tests (different objects), sigkill test, mutation proof, visual diff (Playwright), smoke test (Playwright), `docs:index`, `context:check`. Extracts test counts from Vitest JSON. Exits non-zero on any failure; writes `VERIFY-REPORT.md`.
- **Mutation tests** (`packages/core/src/mutation.test.ts`, 5 tests M1-M5):
  - M1: Lock check — locked write fails with `E_LOCKED`.
  - M2: Conflict check — conflicting write fails with `E_CONFLICT`.
  - M3: Scope check — patch path traverses to target object.
  - M4: Descendant-lock check — descendant write with locked ancestor fails with `E_LOCKED`.
  - M5: Schema validation — invalid scene returns null from readScene.
- **New concurrency tests**: `multi-process.test.ts` (4 real OS processes, "different objects" & "same object" races, 50 retry loops handling `E_CONFLICT`/`E_LOCKED`), `sigkill.test.ts` (child holds trd 9.2 scene lock, SIGKILLed mid-write, stale lock reclaimed by next writer).

---

## Bugs Found and Fixed This Session

1. **Parallel test interference on shared state**: all concurrency tests shared the literal sceneId `s_01ARZ3NDEKTSV4RRFFQ69G5FAV` and (for multi-process) the literal `testDir` `.test-mp-vitest`. Vitest runs describe blocks in parallel → cross-test collision (setup overwrite, zombie scene locks held by alive processes → 12 attempts × 50ms → timeout → `E_LOCKED`; duplicate scene revisions). **Fixed**: `multi-process.test.ts` rewritten — unique `sceneId`/`objectId`s + unique `testDir` per `it()`, spawned children tracked in a `Set`, killed (`SIGTERM` → `SIGKILL`) in `afterEach`, sequential `mkdir` then `writeFile` (no concurrent mkdir/write).

2. **Crockford ID generator bug**: the regex is `^(o|s|c|p|a|q|v|k)_[0-9A-HJKMNP-TV-Z]{26}$`. My generator's alphabet included **`L`** (the regex **skips L** — class is `0-9 A-H J-K M-N P-T V-Z`, excluding I, L, O, U) and I used `n % 34` on a 32-char alphabet (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`). Schema validation rejected the generated IDs, causing every worker to fail. **Fixed**: alphabet = `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, modulus `% 32`.

3. **setupScene race**: ran `mkdir` + `writeFile` concurrently via `Promise.all` → writes ran before the directory existed → `ENOENT`. **Fixed**: sequential `await fs.mkdir` then `await fs.writeFile`.

---

## Remaining Blocker (NOT yet fixed)

- The "4 procs on different objects" test still flaks ~1 in 6 runs: one worker returns `E_LOCKED`, the test runs ~28s and ends with **3 of 4 successes**.
- **Root-cause chain** (reproduced via worker logs): a worker gets stuck spinning in the object-lock `acquire` while holding the trd 9.2 scene lock → the other workers can't acquire the scene lock (`acquireSceneLock` = 12 attempts × 50ms = 600ms → `E_LOCKED`) → they retry the whole `writePipeline` 50× (each acquiring the scene lock up to 600ms) → ~28-30s before giving up → 3/4 successes.
- The `acquire` object-lock is a read-modify-write on `.intent/locks/<sceneId>.locks.json`: `readLocks` → `push(objectId)` → `writeLocks` → `readLocks` verify, with 50×5ms retry. The contention window under the scene lock still allows the retry to exceed 250ms, which stalls the scene lock.
- **Intended fix** (not yet implemented): replace the shared-array object lock with **per-object lock files** (`locks/<sceneId>/<objectId>.lock`, atomic `fs.writeFile(..., {flag:"wx"})`), `getLockedObjects` from `readdir`, `readLocks`/`writeLocks` derived from the files. This removes the read-modify-write race entirely. Requires care keeping `StoragePort.readLocks/writeLocks` (LocksFile format) consistent with `LockPort` — `packages/core/src/ports.ts` and `packages/adapters-node/src/index.ts` would both need updating; `adapters-node` re-exports core's `createLockPort`.
- After the current fixes, "4 procs on same object" passes cleanly; "different objects" passes most runs but the E_LOCKED cascade remains the open issue for the M1 gate.

---

## Artifacts Referenced (do NOT re-read; the above summarizes them)

- `docs/plan.md` (v0.2, incl. S-1 status table), `docs/versions.md`, `docs/USAGE.md`, `docs/INDEX.md`, `README.md` — draft/unused in working tree.
- `scripts/verify.mjs`, `scripts/mutation-check.mjs`, `tests/verify.mjs`-style harness entry points.
- `packages/core/src/{pipeline.ts,patch.ts,ports.ts,error.ts,index.ts,multi-process.test.ts,sigkill.test.ts,mutation.test.ts}`.
- `tests/multi-process/worker.mjs`, `tests/sigkill/worker.mjs`.
- `packages/adapters-node/src/index.ts` (file storage/port + `createFileLockPort`), `packages/mcp-server/src/index.ts` (`createFileLockPort` via adapters, `getLockedObjects("default")`).
- Prior agent's handoff (system-prompt text) described R-B1..R-B4 + S-1; it was never written to the OS temp directory.

---

## Current Session Objective (M1 Release Candidate regression pass)

- **Objective**: repair regressions vs docs, update `verify`/mutation proof, document readiness, produce the verify table + S-1 status table. **No new features.**
- **Alongside**: fix the flaky multi-process tests and the `E_LOCKED` issue raised by the object-lock rewrite (R-B1/R-B2/R-B3).