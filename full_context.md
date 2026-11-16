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
