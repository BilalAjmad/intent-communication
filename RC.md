# Intent — Release Candidate Status

Date: 2026-11-16
Scope: M1, in-tree state at the current working tree (M2.A engine growth and M2.B/M2.C slices landed on top of M1). Nothing has been pushed or tagged.

> **The M1 gate verdict was NOT READY for v0.1.0 until 2026-11-16. On 2026-11-16 the project owner ruled the remaining evidence classes out of scope (see "Owner rulings" below); the gate is now CLOSED BY OWNER WAIVERS — explicitly NOT the same as "proven on Linux/macOS, against live agents, or by human strangers". None of those three claims is made or implied. Everything else is evidence-backed.**

## Owner rulings (2026-11-16) — what the owner decided, dated, in writing

- **AC-M1-11 (Tier 1 smoke: live Claude Code + Cursor sessions) — WAIVED by owner ruling 2026-11-16.** The Intent project has no agent/runtime dependency and needs no API key. No live agent session was run; `tests/smoke/CHECKLIST.md` remains intentionally empty. This AC is **not satisfied** and is not claimed anywhere in this repo. The demo-D gate no longer depends on it.
- **AC-M1-13 (stranger test with 3 humans) — WAIVED by owner ruling 2026-11-16.** The Demo D infrastructure walkthrough **was executed automatically on this machine (Windows 11) on 2026-11-16** via `tests/tier1-smoke.spec.ts` **5/5 pass** (init → doctor → export → open in browser → zero network requests). That is automated evidence of the *infrastructure*, never a claim that humans tested the product. The 3-stranger test was **not run** and is not claimed.
- **AC-M1-01/04/07/08 (Linux/macOS) — WAIVED by owner ruling 2026-11-16.** No Linux/macOS machine exists in this environment. CI matrix is configured (ubuntu/windows/macos) but was never observed to run; every platform-sensitive result (build/test/fidelity/security) is Windows-11-only evidence. No macOS/Linux claim is made.
- **Gate authority.** By the owner ruling of 2026-11-16, with the three evidence classes above explicitly waived (not faked), the M1 gate is **CLOSED BY OWNER WAIVERS**: M1 is feature-complete and verified on this machine; the waived claims are permanently unmade. Tag/push/publish remain the owner's call alone and were not done — nothing was bypassed.

## What works (verified with evidence, this tree)

- **All 12 verify steps pass** on this machine (Windows 11, Node v22.23.4, pnpm 9.7.1): install, build (11/11), typecheck, lint, unit+integration **552/552**, multi-process 2/2, sigkill 1/1, mutation proof 5/5, visual diff 6/6, smoke 5/5, docs:index, context:check. See `VERIFY-REPORT.md` (regenerated; gitignored).
- **Full Playwright suite: 79/79** on Windows 11 (includes visual-diff pixel comparisons, smoke, fidelity-pixel 42/42, keyboard-only flow, interview-tab, axe, the summary-change path, and the annotations end-to-end + Inspector force-state specs).
- **Playback of earlier evidence remains valid on this machine** (interview tab, TC-INT-17, TC-SRV-04, TC-STU-08, TC-INT-E2E, axe, /api/patches pagination, envelope, .intent/.gitignore, intent mcp stdio — all previously recorded; code still green today).
- **Interview tab, real code, no fixtures** (this pass): question card with options / "0) Don't know, you choose" / "s) Skip" / why-asked; estimated-understanding meter with topic chips (icon + text); summary screen with `[you said]` / `[chosen by me]` tags and the three buttons; answers POST to `/api/interview/answer` into `.intent/interview/state.json`; Studio answer wins over chat; `get_feedback` returns unconsumed answers once.
- **TC-INT-17** — Studio answer returned by `get_feedback` exactly once; a later chat answer for the same questionId is ignored with a note. 3/3 unit tests pass.
- **TC-SRV-04** — SSE: Last-Event-ID replay of the last 100 events; a larger gap sends `resync`. 2/2 unit tests pass.
- **TC-STU-08** — the Interview tab card content equals the plain-text card. Pass (Playwright, real server).
- **TC-INT-E2E** — real-UI roundtrip: `ask_user` via `/api/mcp` → question visible in the Studio tab → answer clicked in the Studio → `get_feedback` returns it once. Pass.
- **axe-core on the Interview tab: 0 critical/serious.** Pass (Playwright).
- **`GET /api/patches` cursor pagination** — base64url cursor of the last item's `[createdAt, id]`, 200 max per page, stable newest-first ordering, `nextCursor` null at the end.
- **`pnpm verify` no longer exceeds any budget**: schema 476 lines, mcp-server 464, server 472 (500-line per-file budget; context:check green).
- **MCP responses use the trd 10.1 envelope** (2026-11-15): `{ ok, data }` / `{ ok, error { code, message, details? } }`; `structuredContent` and the text block carry the same object; failures set `isError: true`; structured tool failures (E_LOCKED/E_CONFLICT) map to the error envelope; `validate`'s verdict stays data. 1 MiB/line cap on the stdio transport.
- **`intent init` writes `.intent/.gitignore` (trd 14.3)**: patches/, annotations/, interview/, runtime.json, state.json, tmp/, logs/, metrics.json ignored; scenes/locks/versions/config/profile/design-profile kept — 4/4 tests incl. real `git check-ignore`.
- **`intent mcp` stdio transport (trd 14.3, 2026-11-15):** a real `@modelcontextprotocol/sdk` client lists **exactly the six tools** over stdio; stdout carries only protocol messages (stderr empty); `tools/list` inputSchema derives from Zod (`validate` = documented hand-written exception) and round-trips valid/invalid examples in ajv (36 test-only tests). `intent init` merges the `intent` server into `.mcp.json` + `.cursor/mcp.json` (merge-json; other servers preserved; idempotent; `--dry-run` writes nothing; absolute node/cli.js paths, spaces-safe) — 9/9 merge tests. Tool descriptions ≤120 words each, ≤700 total (trd 10.1).

## What does NOT work / is NOT done (stated plainly, 2026-11-16)

- **A live agent smoke was NOT run — by owner ruling 2026-11-16, the project has no agent/runtime dependency and none is needed.** Nothing agent-dependent was faked: tests/smoke/CHECKLIST.md stays intentionally empty and AC-M1-11 is waived (see Owner rulings).
- **A human stranger test (3 people) was NOT run — waived by owner ruling 2026-11-16.** Demo D's infrastructure walkthrough was executed automatically (tests/tier1-smoke.spec.ts 5/5, Windows 11) — automated evidence only, never a human claim.
- **97–99% intent match is an unmeasured target**, not a measured result. The meter is implemented (capped-89 rule) and golden-tested offline, but no production session has produced the acceptance number.
- **macOS/Linux have never been executed.** CI (ubuntu/windows/macos matrix) is configured but has not been observed to run here. Fidelity calibration is Windows-only. Waived by owner ruling.
- **Interview summary "Change something"** — automated-tested (2026-11-15); edits items in the DOM as contenteditable; no diff/confirmation path for edited items; `Exactly right` marks the interview `complete`. `Ask more questions` records `summaryChoice: "ask-more"` and keeps the interview in progress.
- **The Studio SPA deep-link fallback is deliberately absent** — unknown paths return 404; the SPA is served at `/` only.
- **An interrupted verify run can leave `packages/core/src/patch.ts` restored from git**; `scripts/mutation-check.mjs` is crash-safe (backup + self-heal) since 2026-11-14, but the class of failure exists.
- **The summary "Change something" path IS automated-tested** (2026-11-15): Playwright spec `tests/interview-summary.spec.ts` drives the real flow — summary renders, items become contenteditable via the button, an edit is typed, "Save changes" posts `summaryChoice: "change"` with the edited items, and the answer lands in `.intent/interview/state.json` (pendingQuestion cleared). Pass 1/1.

## Owner-ruled findings from 2026-11-16

- **All dependency vulnerabilities are closed**: `pnpm audit` → **"No known vulnerabilities found"** (was 19 findings incl. 3 critical in the dev/test toolchain). Closed by: zod 3.25.76 → ^4.6.7 (GHSA-mrhx-c7xc-m3w5); vitest 2.1.9 → 5.1.0; vite → 8.3.8 (root + studio); @types/node → ^22; @typescript-eslint → 8.72.2; pnpm override `minimatch@>=7 <11 → ^11.0.1`. Zero shipped-runtime-dep findings throughout; all closures are dev/test toolchain.
- **Linter now ships the full M2 ruleset** (L-TYPE, L-TOKEN, L-STATES, L-ALIGN, L-HIER, L-A11Y, L-CONTENT) with fixture tests (46/46); M1 rules unchanged.
- **React exporter golden files + AC-M1-06 byte-identical determinism test added**; export injection suite unchanged and green.
- **M2/M3 are partially built** (M2.A engine growth + linter M2 ruleset + annotations + Studio overlay + Preview state; RenderModel refactor NOT done; M2.C remainder and M3 not built). M3 remains out of scope for this RC.

## Risks

- **Status “applied” without agent verification**: `apply_patch` marks feedback `applied` on success — the agent could mark its own patch applied; the Studio has no independent verifier. (Mitigation today: human reads the diff; colors/tray are advisory only.)
- **Stale locks can expire while a holder is paused** (>10 s stale reclaim): a suspended OS or a long GC pause can have its lock reclaimed underneath it. Untested on real sleep/wake cycles.
- **SSE fan-out is in-memory, single process**: a server restart silently drops the ring and replayed history; clients must treat `resync` as a full reload. No persistence of `.intent/events` beyond the current process.
- **`.intent/interview/state.json` is rewritten wholesale** on every `ask_user`/answer; a concurrent external edit between read and write is lost. Atomic writes prevent torn files, not lost updates.
- **The SPA CSP pins the two constant preview inline scripts by sha256**: any change to those scripts breaks the preview silently unless the hashes in both policies are regenerated (no automation for this).
- **Pixel fidelity thresholds are zero**; a font or rasterizer difference on a different OS would fail CI without a recalibration. CI is unobserved.
- **All evidence is this one Windows machine** (plus whatever CI shows later). No clean-machine run has happened.
- **No push / no tag / no release has happened.** The user decides.

- **zod migrated to `^4.6.7` on 2026-11-16** (was 3.25.76): **GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404 closed** (`$ZodArray` issue accumulation, patched in >= 4.6.6). The tool/list schemas now derive via `z.toJSONSchema(schema, { io: "input" })` (zod-to-json-schema dropped as a direct dep). **`pnpm audit` reports ZERO vulnerabilities found (2026-11-16**, after the vitest 5.1.0 / vite 8.3.8 / @types/node ^22 / minimatch override cleanup (commit 9ff7419)**)**. The 1 MiB stdio line cap and `objectIds.max(50)` mitigations remain in place as defense-in-depth.

## AC-M1 gate audit — evidence per criterion (2026-11-16, this machine; owner rulings dated 2026-11-16)

`pnpm verify` 12/12 PASS (unit 552/552) and full Playwright suite **79/79**, Windows 11, Node v22.23.4, pnpm 9.7.1. Everything below is what those runs prove, what the owner waived, and what remains unproven.

| AC | Verdict | Evidence / why |
|----|---------|-----------------|
| AC-M1-01 | **Pass (Windows) — Linux/macOS waived** | Windows evidence: `init`/`doctor`/`export` in unit + smoke tests (CLI 46/46); real init in temp dir produced correct `.mcp.json` + `.cursor/mcp.json`; smoke 5/5; owner ruling 2026-11-16 waives Linux/macOS observation (CI configured, never observed) |
| AC-M1-02 | Pass | Interview meter + golden-file suites (small/medium/large) pass (packages/core/src/interview/*.test.ts) |
| AC-M1-03 | Pass | contract.test.ts, tool-errors.test.ts, tool-schemas.test.ts (37): six tools, every error-code path, E_SCHEMA with issue path, descriptions ≤120/700 words (trd 10.1) |
| AC-M1-04 | **Pass (Windows) — Linux/macOS waived** | multi-process 2/2, sigkill 1/1, lock-stale 4/4, atomic-write tests; Linux/macOS waived by owner ruling 2026-11-16 |
| AC-M1-05 | Pass | Linter 46/46 (M1: L-SCHEMA, L-GRID, L-CONTRAST, L-TOUCH, L-LOCK; M2 ruleset L-TYPE/L-TOKEN/L-STATES/L-ALIGN/L-HIER/L-A11Y/L-CONTENT), each with passing+failing fixture |
| AC-M1-06 | Pass | Engine 104/104 + security 24/24 + **new byte-identical exportToHtml determinism test**; injection neutralized, no external URLs (CSP meta + allowlist) |
| AC-M1-07 | **Pass (Windows) — Linux/macOS waived** | fidelity-pixel 42/42 (test updated: robust anchor; mutation detected deterministically); visual-diff 6/6; Linux/macOS waived by owner ruling 2026-11-16 |
| AC-M1-08 | **Pass (Windows) — CI waived** | 22 server SEC tests + export XSS fixes + 1/1 mutation proof; CI observation waived by owner ruling (matrix configured, never observed) |
| AC-M1-09 | Pass | keyboard-only 2/2, interview-tab spec, 79/79 suite |
| AC-M1-10 | Pass | CLI 46/46 (init incl. --dry-run writes nothing, drift + budget tests) + .intent/.gitignore 4/4 (git check-ignore) |
| AC-M1-11 | **WAIVED — owner ruling 2026-11-16** | Project has no agent/runtime dependency; no live agent session run; CHECKLIST.md empty by design; never claimed |
| AC-M1-12 | **Pass** | typecheck 0, lint 0, docs:index fresh, no `any` in shipped src; **pnpm audit: 0 vulnerabilities found** (zod ^4.6.7, vitest 5.1.0, vite 8.3.8, minimatch override; commit 9ff7419) |
| AC-M1-13 | **Partial — walkthrough PASS, stranger test WAIVED** | Demo D infrastructure walkthrough EXECUTED automatically 2026-11-16 (tests/tier1-smoke.spec.ts 5/5, Windows 11); the 3-stranger human test was NOT run and is waived by owner ruling 2026-11-16; never claimed |

**Gate verdict: M1 is CLOSED BY OWNER WAIVERS (2026-11-16).** With the owner's written rulings above, every M1 acceptance criterion is either evidence-backed on this machine (Windows 11) or explicitly waived — never faked. What is permanently NOT claimed: Linux/macOS verification, live-agent sessions, human stranger testing, 97–99% production acceptance rate. Tag/push/publish remain the owner's call alone and were not done.

## Planned versus actual (PL-11, honest record)

- Planned: 15 M1 steps with demos per slice. Actual: S-1-01..13 Done-local; S-1-14 partial (demo transcribed; Tier 1 checklist unrun); S-1-15 partial (this audit; review.md holds the design-level AC audit).
- Cut per P1: Refine mode and `metrics.json` moved to M2. Parking lot unchanged.
- Scope added beyond the original M1 plan (by explicit rulings): Interview tab (S-1-12-adjacent), `intent mcp` stdio transport (trd 14.3), init MCP merge (.mcp.json + .cursor/mcp.json), trd 10.1 response envelope, `.intent/.gitignore`, docs/versions.md, smoke checklist reset.
- Defects found late and fixed: SSE replay/resync (TC-SRV-04), /api/patches cursor pagination, mutation-check crash-safety, schema/src/index.ts UTF-16 corruption incident (restored from git, re-applied via node scripts), two 500-line budget overruns (mcp-server, server, schema — split into helpers/event-bus/interview.ts), load-flake in TC-INT-17 (explicit 15s timeouts, assertions unchanged), two lint unused-var failures, one zod unconstrained-array gap (objectIds, fixed), one stale test assumption (ask_user shape ×3), one full verify interruption (server restart during lint — fixed and re-run).
- Deliberate scope discipline: M2/M3 untouched; no push, no tag, no publish, nothing bypassed to look green.

## Handoff (2026-11-16)

0. **The M1 gate is CLOSED BY OWNER WAIVERS (2026-11-16).** The demo-D path no longer depends on an agent runtime: the project has no agent dependency and never did.
1. **Do not tag, push, or publish without the owner's explicit instruction.** The waivers are dated and written; the owner remains the sole authority for release.
2. Everything that could be executed and verified on this machine has been (see AC table). Remaining future work belongs to M2 remainder and M3 — not to M1.
3. Keep the 12 verify steps green; if anything regresses, the gate evidence goes stale.

## What the user must decide (cannot be decided by the agent)

- Tag v0.1.0? Publish? Push? (all three are the user's call)
- LICENSE: MIT (completely free for everyone) chosen 2026-11-18 (owner directive)


## Historical snapshot

See `git log --oneline` and the change log in docs/plan.md §19. Earlier RC numbers (379/379 unit, pre-Interview-tab) are superseded by the 2026-11-15 state above.
