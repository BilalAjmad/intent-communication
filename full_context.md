# Full Context — 100/100, Zero Context Loss

**Source**: `H:\intent communication` workspace + this session
**Date**: 2026-11-13 (~23:00)
**Strictness**: 100/100 full context, strictly 0 context loss
**Purpose**: Complete project snapshot for hand-off, exact recreation of the current state

---

## 1. Repo layout & git state

- **Path**: `H:\intent communication`; git repo, branch `main`
- **HEAD**: `13b51e0` — `docs: sync README/RC/CHECKLIST with measured reality (263 tests); fix verify harness test-count extraction`
- **Recent lineage** (all committed):
  - `13b51e0` docs: sync README/RC/CHECKLIST with measured reality (263 tests); fix verify harness test-count extraction
  - `d1b15ba` feat(core): reclaim stale object locks and harden patch paths
  - `b78140c` chore: adopt MASTER AGENT RULES in the project (project root + .kilocode/rules)
  - `4b581af` docs: record phase 0/1 execution state and the ultra-verification sweep in the plan
  - `8b87831` security: fix two browser-verified exported-HTML XSS classes and build the missing server auth
  - `d825918` fix: unbreak build and make the suite honest
  - `63d9ef8` wip: checkpoint prior agent's M1 regression pass (build broken on skills+server, 20 tests failing)
- **Working tree**: clean
- **Extra branch**: `phase2-concurrency` (worktree at `H:\intent-phase2-concurrency`, based on `4b581af`) — **redundant**, superseded by this folder's work; kept until user rules on deletion (deletion is destructive).
- **Toolchain**: Node 22, `pnpm` 9.7.1, Vitest 2.1.9, Playwright 1.65, TypeScript 5.5 (ES2022/ESNext)
- **Packages**: `schema`, `core`, `linter`, `adapters-node`, `engine`, `mcp-server`, `server`, `studio`, `skills`, `cli`
- **Configs**: `pnpm-workspace.yaml`, `tsconfig.json`, `playwright.config.ts`, `packages/*/package.json`

---

## 2. Verification state (this session, 2026-11-13 17:20 measured)

`pnpm verify` → **12/12 PASS** with real output:

| Step | Status | Detail |
|------|--------|--------|
| install | PASS | lockfile up to date |
| build | PASS | 10/10 packages |
| typecheck | PASS | 0 errors |
| lint | PASS | 0 errors |
| unit+integration tests | PASS | **263/263** across 10 packages (schema 31, core 85, linter 17, adapters-node 19, engine 42, mcp-server 25, server 21, studio 5, skills 9, cli 9). Earlier broken: reported "1/1" due to stale vitest-JSON schema extractor. |
| multi-process tests | PASS | different objects & same object, 2/2 |
| sigkill test | PASS | SIGKILL'd child lock reclaimed |
| mutation proof | PASS | 5/5 mutations detected |
| visual diff | PASS | 11 tests |
| smoke test | PASS | 11 tests |
| docs:index | PASS | 15 S-1 steps found |
| context:check | PASS | schema = 496 lines ≤ 500 |

Direct runs (this session, various):
- 85 core tests pass (incl. 4 lock-stale + 7 patch.test.ts)
- 11 Playwright tests pass
- 10 consecutive multi-process + sigkill runs green (later 20-run sample was interrupted by server restart; re-run pending)

---

## 3. What was fixed in this pass

### 3.1 Unbreak (Phase 1, commit d825918)
- **skills/src/index.ts:83** — unescaped backticks inside template literal (`{ patch }` broke tsc with TS1005). Fixed.
- **server/src/index.ts:41** — `createFileLockPort(this.storage)` passed StoragePort where a path string was expected → TS2345. Fixed by passing `config.projectRoot`.
- **adapters-node/src/index.test.ts** — `createFileLockPort(storage)` same API mismatch. Fixed to pass the root path.
- **core/src/index.test.ts** — 3 stale assertions (acquire expectations, lock leak). Root-caused to `createLockPort` ignoring the storage root; fixed by exposing `rootDir` and deriving lock dirs.
- **core/src/mutation.test.ts M5** — `readScene` now validates via `validateScene`, returns null for invalid scenes.
- **core/src/conformance.test.ts** — was asserting `expect(true).toBe(true)` placeholders; rewritten to assert against real `MCP_TOOLS`, `ErrorCodes`, interview bank, and SEC names in server tests.
- **verify harness test-count** — now strips ANSI escapes and supports vitest v2 JSON + regex fallback; unit+integration step reports 263/263 (was "1/1").
- **lint** — dead `runWorker` removed; `isStale` now used; catch blocks carry comments.

### 3.2 Security (Phases implied by Phase 1, commit 8b87831)
- **Two browser-verified XSS classes in exported HTML** (product's deliverable):
  - **Finding A (HIGH)**: `JSON.stringify` into inline `<script>` — `</script>` in scene data broke out. Fixed by `escapeJsonForScript` (escapes `<`→`\u003c`, `>`→`\u003e`, `&`→`\u0026`).
  - **Finding B (HIGH)**: Zod union fallback (`BaseObjectSchema`) accepted invalid `variant`/`fit`/`type`; engine emitted raw strings into attributes. Fixed by `safeClassToken` + input-type allowlist + `escapeHtml` everywhere.
  - Browser proof: `window.__PWNED__ === undefined` after fix.
- **Finding C (MEDIUM)**: No CSP meta emitted despite `cspNonce` option (nonce+style/script) — inert nonce. Fixed: `buildCsp()` emits trd 13.3 policy: `default-src 'none'`, `style-src 'unsafe-inline'`, `script-src 'unsafe-inline'` (plus nonce when provided), `img-src data:`, `base-uri 'none'`, `form-action 'none'`.
- **Finding D (MEDIUM)**: No URL allowlist; `<img src="https://evil...">` and `javascript:` emitted (trd rule 8 violation). Fixed: `sanitizeUrl` — data URIs with raster MIME only, fragment links, relative paths; everything else dropped (`src=""`).
- **Finding E (MEDIUM)**: CSS value grammar open (`url()`, statement separators, CSS escapes). Fixed: `sanitizeCssValue` — drops `url(`, `;`, `{`, `}`, `\`, over-512-char strings, non-allowlist chars.
- **24 regression tests** in `packages/engine/src/security.test.ts`. Engine test asserting external URL now asserts `src=""` instead.
- **Server auth stub** (HIGH): `/api/session` accepted ANY non-empty token and stored attacker token as cookie; `/api/protected`, `/mcp`, `/events` required nothing; preflight answered 204; no body cap. Now: timingSafeEqual token exchange, random 256-bit session id, `HttpOnly; SameSite=Strict; Path=/api; Max-Age=1800`, 2 MB body cap (413), exact Host, Origin match on non-GET (403 no detail otherwise), OPTIONS refused (403), idle expiry (30 min).
- **Vacuous SEC tests** (`expect([200,403]).toContain`, `expect(true).toBe(true)`) replaced with 19 real assertions in `packages/server/src/security.test.ts`.

### 3.3 Concurrency & atomicity (Phase 2, commits d1b15ba + 13b51e0)
- **Inter-agent collision**: while this session held no files, another agent (a parallel session) rewrote `ports.ts` (object locks → `locks.json` registry under `.intent/locks/<scene>.locks.json`), added `atomic.ts` (fsync + Windows rename retry + symlink guard), rewrote the mutation-proof harness, and re-verified 12/12. That rework was adopted rather than discarded.
- **Proven defect**: registry entries had no owner metadata → crashed writer locked object forever (deadlock). Demonstrated live.
- **Fix**: additive `owners` map in `LocksFileSchema` (`{objectId → {pid, ownerToken, createdAt}}`, non-strict zod object, no runtime validation). `acquire()` reclaims dead/stale entries; `release()` removes only the ownerToken this process registered; `getLockedObjects()` filters dead/stale entries for descendant-lock check. Process-alive check is `process.kill(pid, 0)` with EPERM→alive.
- **Path safety**: `applyPatch` rejects `..`, `.`, empty segments, `__proto__`/`constructor`/`prototype`, path separators, >512-char paths, and restricts `set`/`unset` roots to trd 6.2 whitelist → `E_BAD_REQUEST`.
- **Tests added**: `patch.test.ts` (7 tests), `lock-stale.test.ts` (4 tests).
- **Verify harness**: test-count extraction now strips ANSI escapes; reports real 263/263 (was "1/1" — actually bogus).

---

## 4. What's still not done (Phases 3–8)

- **Phase 3 — Interview meter (S-1-06)**: `packages/core/src/interview/bank.ts` exists; `meter.ts` does not. AC-M1-02 needs the meter (caps, fatigue, delegation, resume). Golden-file tests needed.
- **Phase 4 — zod HIGH** (GHSA-mrhx-c7xc-m3w5): memory exhaustion validating oversized constrained collections; also trd 20 limits absent (objects ≤2000, text ≤2000 chars, children ≤200, depth ≤24, patch ops ≤200, scene file ≤5 MB).
- **Phase 5 — Studio preview renderer + SSE + keyboard-only flow** (S-1-11/12/13, AC-M1-07/09): separate preview renderer; SSE status updates live; keyboard-only flow test.
- **Phase 6 — CLI drift/coverage/budgets + CI matrix** (S-1-09, AC-M1-01/10): `--dry-run`, drift test, coverage test, budget check; CI on Linux+macOS+Windows.
- **Phase 7 — Demo D + smoke record** (S-1-14, AC-M1-11/13): `docs/demo-d.md`; `tests/smoke/CHECKLIST.md` fully filled with real versions/dates/results — not "UNVERIFIED".
- **Phase 8 — M1 gate** (S-1-15, AC-M1-12): AC-M1-01..13 audit in `docs/review.md`; honest README/RC/CHECKLIST refresh (RC.md already updated this pass).
- **Context docs refreshed** — `context.md`, `usercontext.md`, `full_context.md` (this file) rewritten to current reality.

---

## 5. Honest notes & risks

- This file's previous version described `E_LOCKED` cascade, `per-object .lock` files, 51/252 test counts, etc. — all obsolete. They are gone from this file deliberately.
- 10/10 multi-process sample is a **sample**; "flake extinct" is not proven. The 20-run sample was interrupted by a server restart; re-run pending.
- Two agents edited the same files concurrently (this session + a parallel one). It landed clean by luck of timing, not by coordination.
- RC.md previously pointed at a stale HEAD; now points at reality.
- `opencode.json` contains a **plaintext Neon bearer token** (`napi_…`); flagged, not fixed (rotation is user's call).
- `AGENTS.md` rules (MASTER AGENT RULES v2026-11-13) deployed to: project root, Kilo Code project rules, Kilo Code user rules, Cline user rules, OpenCode user instructions (referenced from `opencode.json`). Kilo Code CLI verified loading them (`kilo debug config`); Kilo Desktop app and Cline desktop assumed (not launched to verify — GUI).
- `.kilocode/` and `AGENTS.md` are untracked (not committed) — deliberate; rules are project policy, left as working files.
- Worktree `H:\intent-phase2-concurrency` (branch `phase2-concurrency`) is redundant; will be deleted only on your instruction.

## 6. Artifacts to read for verification

1. `VERIFY-REPORT.md` — measured 12/12, 263/263
2. `docs/security-audit-2026-11-13.md` — full security findings + fixes
3. `RC.md` — current RC state
4. `CHECKLIST.md` — RC verification table (263 tests)
5. `docs/INDEX.md` — regeneration index
6. `docs/superpowers/plans/2026-11-13-m1-gate-100.md` — the phased plan
7. `git log --oneline -6` — commit lineage
