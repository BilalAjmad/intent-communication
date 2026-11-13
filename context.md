# Intent Communication — Full Project & Session Context
**Source of truth, zero context loss. Updated 2026-11-13 ~23:00 (this session).**

---

## Repo layout & git state
- Path: `H:\intent communication`; git repo, branch `main`.
- HEAD = `13b51e0` — `docs: sync README/RC/CHECKLIST with measured reality (263 tests); fix verify harness test-count extraction`
- Recent lineage:
  - `13b51e0` docs: sync README/RC/CHECKLIST with measured reality (263 tests); fix verify harness test-count extraction
  - `d1b15ba` feat(core): reclaim stale object locks and harden patch paths
  - `b78140c` chore: adopt MASTER AGENT RULES in the project (project root + .kilocode/rules)
  - `4b581af` docs: record phase 0/1 execution state and the ultra-verification sweep in the plan
  - `8b87831` security: fix two browser-verified exported-HTML XSS classes and build the missing server auth
  - `d825918` fix: unbreak build and make the suite honest
- Working tree: **clean** (all work committed).
- Extra branch in repo: `phase2-concurrency` (worktree at `H:\intent-phase2-concurrency`, based on `4b581af`, **redundant** — superseded here. Deleting is destructive; user ruling pending).
- `.kilocode/rules/AGENTS.md` (project rules copy) + root `AGENTS.md` (project rules) are untracked per session; left in place intentionally.
- Toolchain: Node 22, pnpm 9.7, Vitest 2.1.9, Playwright 1.65, TypeScript 5.5 (ES2022/ESNext), Vitest coverage, ESLint 9.
- Packages: schema, core, linter, adapters-node, engine, mcp-server, server, studio, skills, cli + tests/, scripts/.

## Verified state (this session, 2026-11-13 17:20 run)
- `pnpm verify` → **12 steps PASS** (install, build, typecheck, lint, unit+integration tests = **263/263** across 10 packages, multi-process, sigkill, mutation proof 5/5, visual diff 11/11, smoke 11/11, docs:index, context:check).
- `context:check` passes (schema = 496 lines ≤ 500 budget).
- `mutation-check.mjs` passes 5/5 detection.
- `sigkill` test passes.
- Multi-process + sigkill runs in this folder: 10 consecutive green samples, and 11/11 Playwright.
- Security: two browser-verified exported-HTML XSS classes fixed (JSON `</script>` breakout in `__INTENT_SCENE__` embed; attribute injection via Zod union fallback reaching `onclick`/`onload`/`onfocus` handlers); server auth built from stub to real (timingSafeEqual token exchange, random Path=/api session id, 2 MB caps, refused preflight, exact Host, Origin match on non-GET, 403 no detail); 19 real SEC tests pass; 24 exporter regression tests; Trivy 0 vulns at all severities; gitleaks clean; pnpm audit 19 advisories all dev-only except zod HIGH.
- Mutation proof (in-tree, after this pass): all 5 detected.
- 10 consecutive multi-process + sigkill runs green (this folder).

## The object-lock design question
- A different agent's RC rework, written into this same tree while this session worked in the worktree, replaced the per-object `.lock` file design from HEAD with a **locks.json registry** (`lockedObjects` array per scene, `.intent/locks/<sceneId>.locks.json`, atomic writes via `writeAtomic`). That rework was adopted here rather than discarded.
- **Proven defect in that rework:** registry entries had no owner metadata; a crashed writer permanently locked its object (deadlock with no reclaim path). Demonstrated with a live script: a stale entry causes `acquire` to return false forever.
- **Fixed here:** `LocksFileSchema` gains an additive `owners` map `{objectId → {pid, ownerToken, createdAt}}` (additive, non-strict, no runtime validation anywhere). Explicitly keep legacy entries without owner info and refuse to unlink them. Dead-owner reclaim in `acquire`, owner-token-checked `release`, `getLockedObjects` filters dead/stale entries for the descendant-lock check.

## AGENT RULES deployed
- `C:\Users\AFZAAL KHAN\Downloads\AGENTS.md` (MASTER AGENT RULES v2026-11-13), copied byte-identical to:
  - `H:\intent communication\AGENTS.md` (project)
  - `H:\intent communication\.kilocode\rules\AGENTS.md` (project Kilo Code)
  - `C:\Users\AFZAAL KHAN\.kilocode\rules\AGENTS.md` (global Kilo Code)
  - `C:\Users\AFZAAL KHAN\.cline\rules\AGENTS.md` (Cline CLI + desktop share `~/.cline/rules`)
  - `C:\Users\AFZAAL KHAN\.config\opencode\MASTER-AGENT-RULES.md` + reference in `~/.config/opencode/opencode.json` `instructions` array (OpenCode) — with backup `opencode.json.bak-20261113202633`
- Kilo Code CLI reads `~/.kilocode/rules/AGENTS.md` (verified via `kilo debug config`).
- Cline global rules: `~/.cline/rules/` (artemis.md + AGENTS.md).
- Kilo Desktop (v0.1.15) embeds `@kilocode/cli-windows-x64-baseline` v7.8.17 — assumed to read same global rules dir; **not launched to verify** (GUI, not headlessly launchable here).
- `opencode.json` contains a plaintext Neon API bearer token (`napi_…`) — **recommend rotation**; flagged in security report, not fixed (out of scope).

## Status of phases (from docs/superpowers/plans/2026-11-13-m1-gate-100.md)
- Phase 0 — Safety net: done (commit 63d9ef8)
- Phase 1 — Unbreak build + honest suite: done (d825918). 252→263 tests after new tests.
- Phase 2 — Concurrency: done in this folder (d1b15ba) + reclaim fix + count fix (13b51e0)
- Phase 3 — Interview meter (S-1-06): **not done**
- Phase 4 — zod HIGH (GHSA-mrhx-c7xc-m3w5) + trd 20 limits: **not done**
- Phase 5 — Studio preview renderer + keyboard-only flow + SSE status (S-1-11/12/13, AC-M1-07/09): **not done**
- Phase 6 — CLI `--dry-run`, drift/coverage/budget tests; CI matrix Linux/macOS/Windows: **not done**
- Phase 7 — Demo D script; `tests/smoke/CHECKLIST.md` fully filled: **not done**
- Phase 8 — AC-M1-01..13 audit; `docs/review.md`; honest README; handoff: **not done**

## Honest risks & gaps
- Registry object-lock design replaced per-object `.lock` files (in-flight rework by another agent, adopted, then fixed). Verified only by behavior tests + 20× sample of multi-process runs; no formal design review signed off.
- 263/263 is a snapshot; flaky behavior probability reduced, not proven extinct.
- VERIFY-REPORT.md's `"1/1"` test-count bug reported here — now fixed (extracts from vitest JSON or regex; 263/263 reported).
- `docs/plan.md` S-1 status table (§8.3.1) still says "51 core tests" / "SEC-07 tests" / "16 tests" — stale vs reality (74 core / 19 security / 263 total).
- `RC.md`/`CHECKLIST.md` referenced stale HEAD `9b98664` before this pass; README "263 tests" is honest only after this pass
- `docs/plan.md` §8.3.1 S-1 status table is stale vs reality (says "51 core tests"/"SEC-07 tests"/"16 tests" while the tree now has 74 core / 19 security / 263 total).
- No macOS/Linux CI performed; Windows only.
- `.intent/` runtime data (locks, tmp) gitignored.
- Two agents edit this tree concurrently; conflicts are possible. Worked this pass because the other agent paused when this session resumed.

## Artifacts you can trust
- `VERIFY-REPORT.md` — regenerated 2026-11-13 17:20, honest 12/12 with 263/263 test count.
- `docs/security-audit-2026-11-13.md` — full security audit findings & fixes.
- `RC.md` — RC status (updated by this pass).
- `CHECKLIST.md` — RC test/status table (updated to 263).
- `docs/superpowers/plans/2026-11-13-m1-gate-100.md` — full phased plan.
- `docs/INDEX.md` — documentation index (regenerated).

## What this file used to say (stale, removed)
- "Remaining blocker: E_LOCKED cascade, per-object lock files not implemented" — per-object lock files were implemented in HEAD at some point; registry rework replaced that again. E_LOCKED cascade resolved by the registry + reclaim.
- "252 tests, all 12 verify steps pass" — true only after this pass; before it, README claims were not verifiable from the harness (extraction bug fixed).
