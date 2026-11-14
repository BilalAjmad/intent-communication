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
