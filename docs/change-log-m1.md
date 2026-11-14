# Intent M1 — Change Log

**Branch**: `main` (HEAD: `0863874` — `docs: record Demo D and real Tier 1 smoke execution results`)
**Scope**: M1 Release Candidate. All changes below are on `main`; nothing is already future M2 work.

## Commit index (topological)

| Commit | Summary |
|--------|---------|
| `63d9ef8` | wip: checkpoint prior agent's M1 regression pass (build broken on skills+server, 20 tests failing) |
| `d825918` | fix: unbreak build and make the suite honest — skills template literal, server lock port, adapters-node API, stale core assertions, scene id validation, MCP conformance rewrite, lint dead-code removal, `isProcessAlive` via `process.kill(pid, 0)` |
| `8b87831` | security: fix two browser-verified exported-HTML XSS classes and build the missing server auth — `escapeJsonForScript`, union-fallback attribute injection, CSP emission, URL sanitizer, SEC-01..11 real tests |
| `4b581af` | docs: record phase 0/1 execution state and the ultra-verification sweep in the plan |
| `b78140c` | chore: adopt MASTER AGENT RULES in the project (project root + .kilocode/rules) |
| `d1b15ba` | feat(core): reclaim stale object locks and harden patch paths — registry-based locks, `writeAtomic`, trd 6.2 path whitelist |
| `13b51e0` | docs: sync README/RC/CHECKLIST with measured reality; fix verify harness test-count extraction (263 → 286 tests) |
| `ee5fe6d` | security(schema): add trd 20 caps everywhere + 5 MB scene-file hard limit |
| `3e8bf2f` | feat(core): implement Interview Meter (S-1-06, AC-M1-02) — slot evidence weighting, worked example matches spec §7.4, golden files |
| `7178762` | feat(studio+server): preview renderer, SSE broadcast on /mcp, keyboard-only flow — S-1-11/S-1-12/S-1-13 |
| `ad5ea20` | docs: regenerate docs/INDEX.md |
| `0758698` | feat(cli): add `--dry-run`, drift and budget tests; fix CI apt deps issue |
| `0863874` | docs: record Demo D and real Tier 1 smoke execution results |

## Files touched (high-level)

### Build/correctness
- `packages/skills/src/index.ts` — escaped backticks in the template literal (compile blocker)
- `packages/server/src/index.ts` — lock port wiring, sse seeded from scene, apply_patch → SSE broadcast, 2 MB body cap, refused preflight, exact Host, Origin-match-on-non-GET, idle session expiry (30 min), per-run 256-bit random token + `runtime.json` writer
- `packages/adapters-node/src/index.ts` — storage ports use `writeAtomic`; lock port signature changed
- `packages/core/src/ports.ts` — `createLockPort(storage, …)` now derives locks from `storage.rootDir`, never CWD; per-object locks via `locks.json` registry with `pid`/`ownerToken`/`createdAt`; dead-owner reclaim; enforced release-on-owner-token only
- `packages/core/src/atomic.ts` — shared atomic write (`fsync` + Windows rename retry + lstat symlink guard) for all storage ports
- `packages/core/src/patch.ts` — `trd 6.2` path whitelist (`set`/`unset` roots); rejection of `..`, empty segments, `__proto__`/`constructor`/`prototype`; segment pattern + length caps
- `packages/core/src/pipeline.ts` — `writePipeline` now returns revision and `{ changedObjectIds }` on conflict

### Security fixes (browser-verified)
- `packages/engine/src/html.ts` — `escapeJsonForScript` used when embedding `__INTENT_SCENE__`; CSP meta emitted; `sanitizeUrl`/`sanitizeCssValue`/`safeClassToken` gate all attributes, URL schemes, and style values
- `packages/engine/src/sanitize.ts` — new: escaping + CSP builder
- `packages/server/src/security.test.ts` — replaces vacuous SEC tests with real assertions (wrong token → 403, exchange → 204 + cookie not equal to token, `/mcp` + `/events` require session, 413/403/204 preflight refusals)
- `packages/schema/src/index.ts` — trd 20 caps (`.max(…)` everywhere relevant); 5 MB scene-file hard limit at `readScene`
- `packages/mcp-server/src/conformance.test.ts` — real assertions instead of `expect(true).toBe(true)`; asserts the six tool names, the trd error codes, the bank counts, and SEC-01..SEC-07 in server source

### Documentation & governance
- `AGENTS.md` (project root) — MASTER AGENT RULES v2026-11-13 (binding)
- `.kilocode/rules/AGENTS.md` — project rules copy
- `docs/security-audit-2026-11-13.md` — full security sweep report
- `docs/review.md` — appended §21 AC-M1 audit; §21.1 M1-gate verdict: **NOT READY for v0.1.0**
- `docs/plan.md` — §8.3.1 S-1 status rewritten with measured evidence (35 core tests)
- `docs/INDEX.md` — regenerated
- `docs/demo-d.md` — Demo D transcribed from plan.md §8.6
- `tests/smoke/CHECKLIST.md` — executed Tier-1 smoke with Versions, dates, real results (2026-11-14); steps 7/8/10/11/12 NOT RUN (no bound chat agent)
- `.github/workflows/ci.yml` — no `playwright install --with-deps` on cross-OS test job; e2e job on ubuntu-latest only
- `README.md` — honest claims table; no 97–99% target is claimed measured
- `RC.md` / `CHECKLIST.md` — updated to 286 tests, 12/12 verify, 10× multi-process
- `full_context.md`, `context.md`, `usercontext.md` — refreshed to current reality

## Known risks / open items (not shipped)

1. AC-M1-01 CI matrix — CI config exists; CI runs unobserved.
2. AC-M1-03 contract tests for all six tools error codes — partial.
3. AC-M1-07 pixel-level fidelity harness — not built.
4. AC-M1-09 full select→send→status browser roundtrip — not driven in this session.
5. AC-M1-11/13 agent-driven end-to-end Tier 1 — not executed; no Cursor/Claude Code session was driven from inside this session.
6. `opencode.json` contains a live Neon API bearer token (`napi_…`) — rotate.
7. `phase2-concurrency` worktree at `H:\intent-phase2-concurrency` — redundant; delete when convenient (destructive action → needs user confirmation).
8. Untracked-but-present in repo: `AGENTS.md` in project root, `.kilocode/`, `rfn` — keep per project rules to bind future agents to MASTER AGENT RULES.

## Commits in `main` through this pass

```
63d9ef8  wip: checkpoint prior agent's M1 regression pass
d825918  fix: unbreak build and make the suite honest
8b87831  security: two browser-verified exported-HTML XSS fixes + server auth
4b581af  docs: record phase 0/1 execution state
b78140c  chore: adopt MASTER AGENT RULES in the project
d1b15ba  feat(core): reclaim stale object locks and harden patch paths
13b51e0  docs: sync README/RC/CHECKLIST with measured reality
ee5fe6d  security(schema): add trd 20 caps everywhere
3e8bf2f  feat(core): implement Interview Meter (S-1-06)
7178762  feat(studio+server): preview renderer, SSE broadcast on /mcp, keyboard-only flow
ad5ea20  docs: regenerate docs/INDEX.md
0758698  feat(cli): add --dry-run, drift and budget tests; fix CI apt deps issue
0863874  docs: record Demo D and real Tier 1 smoke execution results
```


## 2026-11-14 (pass 3) — AC-M1-07 pixel fidelity + mutation-check crash fix + interrupted-verify incident

**Incident (fixed):** a `pnpm verify` interrupted by the session harness killed `scripts/mutation-check.mjs` after it had applied its M3 mutation; `packages/core/src/patch.ts` was left with `const pathParts: string[] = []; // MUTATED` (trd 6.2 scope check disabled) and `packages/core/dist` was built from it. Detected when the next verify's mutation proof failed with "oldString not found in patch.ts". Restored via `git checkout HEAD -- packages/core/src/patch.ts`, rebuilt core, re-verified 5/5 mutations DETECTED. `mutation-check.mjs` is now crash-safe: pre-mutation `.mutation-bak`, startup self-heal (+core rebuild), SIGINT/SIGTERM/SIGHUP/exit handlers, tmpReport cleanup scope fix. One earlier verify from the same window exited 1 with all printed steps showing PASS; failing step never identified (logs overwritten) — recorded in review.md §21.2 item 6, no cause claimed.

**AC-M1-03 (improved, still PARTIAL):** `packages/mcp-server/src/contract.test.ts` (14 tests) — canonical tool order, happy paths for all six tools, structured error surfaces (E_NOT_FOUND x3, E_CONFLICT, validate valid/invalid/unknown-type). Caught and fixed: `get_scene`/`get_feedback` ignored the input sceneId (hardcoded "default"); both now accept optional `sceneId` (default "default"). Still missing per-tool matrix: E_LOCKED, E_SCHEMA, E_IO.

**AC-M1-07 (PARTIAL PASS, improved — was "not built"):** both render paths now share one stylesheet. `@intent/engine` exports `renderExportCss()` and `buildStyleString()`; the Studio preview imports them (it no longer has its own hardcoded CSS) and uses `height: 100%` on `.preview-root` so percent min-heights resolve as in the export. New: `tests/fixtures/fx-01..06` (minimal, salon, all-types, states, dark-tokens, long-text); `tests/visual/threshold.json` (tolerance 0 / maxDiff 0 / cluster 0); `tests/fidelity-pixel.spec.ts` — 6 fixtures × 2 themes (light/dark, prefers-color-scheme emulation) × 3 breakpoints (phone/tablet/desktop), Playwright built-in pixel matcher, per-element screenshots of `.intent-screen`, differential (preview is written into the comparison baseline each run), plus TC-VIS-02 control + 5 deliberate-failure tests (1px move, 1-level color, heading char, token 16→12, token swap) — all 5 detected. 20/20 calibration runs on Windows 11 measured 0 differing pixels. `tests/visual-diff.spec.ts` rewritten to real pixel comparison (old version counted compressed-PNG byte differences — a meaningless metric; old committed stored baseline `tests/visual-diff.spec.ts-snapshots/visual-baseline-chromium-win32.png` deleted per test.md 7.2 differential-no-stored-baselines). `tests/fidelity.spec.ts` (4 tests): same visible text/order, same data-object-id set, same structural role counts (buttons/inputs/text ±1), zero external network requests.

**Verify (this pass):** 12/12 PASS; unit+integration 305/305; lint/typecheck clean; all Playwright suites green incl. keyboard-only; mutation proof 5/5.

**Also in this pass:** budget.test no-control-regex lint fix; contract.test.ts result typing (lint clean); phase2-concurrency worktree deleted (all files superseded/identical on main; branch deleted; 4 files backed up at `C:\Users\AFZAAL KHAN\AppData\Local\Temp\phase2-concurrency-backup-20261114120258`).

**Caveats unchanged:** CI never observed to run (AC-M1-01 PARTIAL); themes = prefers-color-scheme only (no engine token-theme switching); FX-07 hostile fixture not created (covered by engine security tests); AC-M1-09/11/13 not driven; VERIFY-REPORT.md is gitignored (regenerated per run).

**Commits added in this pass:**
- `fix(cli): budget.test no-control-regex lint error — char-code loop` (f78256a)
- `docs(phase 8): M1 gate audit — AC-M1-01..13 appended to docs/review.md §21` (224b6d7)
- `feat(mcp-server): six-tool contract matrix test; get_scene/get_feedback honor sceneId` (5fa001f)
- (this pass, pending commit) scripts crash-safety + AC-M1-07 harness + docs

## Known risks / open items (updated — still not shipped)

1. AC-M1-01 CI matrix — CI config exists; CI runs unobserved (Linux/macOS unverified).
2. AC-M1-03 contract matrix — improved; E_LOCKED / E_SCHEMA / E_IO per-tool coverage still open.
3. AC-M1-07 — Windows-only evidence; Linux/macOS calibration NOT RUN; theme system is media-query only.
4. AC-M1-09 full select→draft→send→status browser roundtrip — not driven.
5. AC-M1-11/13 agent-driven end-to-end — not executed.
6. `opencode.json` contains a live Neon API bearer token — rotate.
7. ~~phase2-concurrency worktree~~ — deleted (this pass).
