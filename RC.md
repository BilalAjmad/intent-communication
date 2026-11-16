# Intent — Release Candidate Status

Date: 2026-11-15
Scope: M1, in-tree state at the current working tree after the Interview-tab pass (SCHEMA/MCP/server/Studio). Nothing has been pushed or tagged.

> **The M1 gate verdict remains NOT READY for v0.1.0** (docs/review.md A-21/A-21.1). This file states what is proven and what is not. Do not read "works" below as a release claim.

## What works (verified with evidence, this tree)

- **All 12 verify steps pass** on this machine (Windows 11, Node v22.23.4, pnpm 9.7.1): install, build (10/10), typecheck, lint, unit+integration **412/412**, multi-process 2/2, sigkill 1/1, mutation proof 5/5, visual diff 6/6, smoke 5/5, docs:index, context:check. See `VERIFY-REPORT.md` (regenerated; gitignored).
- **Full Playwright suite: 77/77** on Windows 11 (includes visual-diff pixel comparisons, smoke, fidelity-pixel, keyboard-only flow, interview-tab, axe, and the summary-change path).
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

## What does NOT work / is NOT done (stated plainly, 2026-11-15)

- **A live agent smoke CANNOT be run on this machine right now — account/billing, not code:** `claude -p "Reply with exactly: OK" --max-turns 1` returns `[claude-code:unrecognized_model] {"model":"z-ai/glm-5.3-flash"}` → `API Error: 402 Insufficient credits. This account never purchased credits.` (`ANTHROPIC_BASE_URL=https://openrouter.ai/api`). Cursor's `agent` CLI is not installed on this machine at all. Nothing agent-dependent was faked: tests/smoke/CHECKLIST.md stays empty.
- **The M1 gate has not been executed** (plan §8.7, S-1-15: Partial). Do not tag v0.1.0, do not publish.
- **Agent end-to-end interview is NOT exercised here.** No live Claude Code / Cursor session drove the interview. The Tier 1 smoke checklist (tests/smoke/CHECKLIST.md) is intentionally **empty** — nothing has been run against a real agent, no version recorded.
- **97–99% intent match is an unmeasured target**, not a measured result. The meter is implemented (capped-89 rule) and golden-tested offline, but no production session has produced the acceptance number.
- **Agent connection steps are verified against the current docs** (2026-11-15, `docs/versions.md`), but **no live Claude Code or Cursor session has been driven end-to-end by this repo**. The Tier 1 smoke checklist (tests/smoke/CHECKLIST.md) is intentionally **empty**.
- **macOS/Linux have never been executed.** CI (ubuntu/windows/macos matrix) is configured but has not been observed to run here. Fidelity calibration is Windows-only.
- **Interview summary "Change something"** edits items in the DOM as contenteditable but there is no diff/confirmation path for the edited items; `Exactly right` marks the interview `complete`. `Ask more questions` records `summaryChoice: "ask-more"` and keeps the interview in progress.
- **Refine mode and metrics.json are deferred to M2** (P1 cut).
- **M2/M3 features** (drag/resize, pencil annotations, pins, unread/pinned, profile learning, Scanner) are not built.
- **The Studio SPA deep-link fallback is deliberately absent** — unknown paths return 404; the SPA is served at `/` only.
- **An interrupted verify run can leave `packages/core/src/patch.ts` restored from git**; `scripts/mutation-check.mjs` is crash-safe (backup + self-heal) since 2026-11-14, but the class of failure exists.
- **The summary "Change something" path IS automated-tested** (2026-11-15): Playwright spec `tests/interview-summary.spec.ts` drives the real flow — summary renders, items become contenteditable via the button, an edit is typed, "Save changes" posts `summaryChoice: "change"` with the edited items, and the answer lands in `.intent/interview/state.json` (pendingQuestion cleared). Pass 1/1. Note: the editable surface is the whole `.summary-item` including the tag span — cosmetic; the saved `changes` array contains every item's final text.

## Risks

- **Status “applied” without agent verification**: `apply_patch` marks feedback `applied` on success — the agent could mark its own patch applied; the Studio has no independent verifier. (Mitigation today: human reads the diff; colors/tray are advisory only.)
- **Stale locks can expire while a holder is paused** (>10 s stale reclaim): a suspended OS or a long GC pause can have its lock reclaimed underneath it. Untested on real sleep/wake cycles.
- **SSE fan-out is in-memory, single process**: a server restart silently drops the ring and replayed history; clients must treat `resync` as a full reload. No persistence of `.intent/events` beyond the current process.
- **`.intent/interview/state.json` is rewritten wholesale** on every `ask_user`/answer; a concurrent external edit between read and write is lost. Atomic writes prevent torn files, not lost updates.
- **The SPA CSP pins the two constant preview inline scripts by sha256**: any change to those scripts breaks the preview silently unless the hashes in both policies are regenerated (no automation for this).
- **Pixel fidelity thresholds are zero**; a font or rasterizer difference on a different OS would fail CI without a recalibration. CI is unobserved.
- **All evidence is this one Windows machine** (plus whatever CI shows later). No clean-machine run has happened.
- **No push / no tag / no release has happened.** The user decides.

- **zod migrated to `^4.6.7` on 2026-11-16** (was 3.25.76): **GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404 closed** (`$ZodArray` issue accumulation, patched in >= 4.6.6). The tool/list schemas now derive via `z.toJSONSchema(schema, { io: "input" })` (zod-to-json-schema dropped as a direct dep). `pnpm audit` now reports 18 findings, **all in the dev/test toolchain** (vitest/vite/tinypool/launch-editor/esbuild) — zero from shipped runtime deps. The 1 MiB stdio line cap and `objectIds.max(50)` mitigations remain in place as defense-in-depth.

## AC-M1 gate audit — evidence per criterion (2026-11-15, this machine)

`pnpm verify` 12/12 PASS (unit 412/412) and full Playwright suite **77/77**, Windows 11, Node v22.23.4, pnpm 9.7.1. Everything below is what those runs prove and what they cannot prove.

| AC | Verdict | Evidence / why |
|----|---------|-----------------|
| AC-M1-01 | **NOT VERIFIED Linux/macOS** | CI matrix configured (ubuntu/windows/macos) but never observed to run. Windows: `init`/`doctor`/`export` exercised in unit + smoke tests (CLI 41/41); `intent init` real-run in temp dir produced correct `.mcp.json` + `.cursor/mcp.json` |
| AC-M1-02 | Pass | Interview meter + golden-file suites (small/medium/large) pass (packages/core/src/interview/*.test.ts) |
| AC-M1-03 | Pass | contract.test.ts, tool-errors.test.ts, tool-schemas.test.ts (36): six tools, every error-code path, E_SCHEMA with issue path, descriptions ≤120/700 words (trd 10.1) |
| AC-M1-04 | **Pass Windows only** | multi-process 2/2, sigkill 1/1, lock-stale 4/4, atomic write tests; Linux/macOS NOT RUN |
| AC-M1-05 | Pass | Linter 17/17 (L-SCHEMA, L-GRID, L-CONTRAST, L-TOUCH, L-LOCK), each passing+failing fixture |
| AC-M1-06 | Pass | Engine 42/42 + security 24/24: byte-identical export, injection neutralized, no external URLs (CSP meta + allowlist) |
| AC-M1-07 | **Pass Windows only** | fidelity-pixel 6/6 (×2 themes ×3 breakpoints, maxDiffPixels: 0, 20/20 calibration); visual-diff 6/6; fidelity 4/4; Linux/macOS NOT RUN |
| AC-M1-08 | **Pass Windows only** | 22 server SEC tests (loopback/token/Host/Origin/traversal/sandbox/banned APIs) + export XSS fixes; CI observation missing |
| AC-M1-09 | Pass | keyboard-only 2/2 (render→select→feedback→draft→send→status), AC-M1-09 roundtrip, 77/77 suite |
| AC-M1-10 | Pass | CLI 41/41 (init incl. --dry-run writes nothing, drift + budget tests) + .intent/.gitignore 4/4 (git check-ignore) |
| AC-M1-11 | **NOT DONE** | Tier 1 smoke checklist is empty; no live Claude Code/Cursor session was run; cannot be produced from this machine |
| AC-M1-12 | **PARTIAL → PASS (deps)** | typecheck 0, lint 0, docs:index fresh, no `any` in shipped src. **zod migrated 3.25.76 → ^4.6.7 (2026-11-16)** — GHSA-mrhx-c7xc-m3w5 closed; tools/list inputSchema via `z.toJSONSchema(..., { io: \"input\" })`; zod-to-json-schema removed. `pnpm audit`: 18 findings, **all in the dev/test toolchain** (vitest/vite/tinypool/esbuild/launch-editor) — zero from shipped runtime deps |
| AC-M1-13 | **NOT DONE** | Demo D transcribed (docs/demo-d.md) but never executed on a clean machine; stranger test (3 humans) never run |

**Gate verdict: NOT READY for v0.1.0.** The remaining blocking items are human/agent-run evidence (AC-M1-11, AC-M1-13) and CI observation (AC-M1-01/04/07/08). The dependency-hygiene part of AC-M1-12 is now closed (zod 4.6.7); the remaining audit findings are dev/test-toolchain only. None of these can be produced by an agent working alone.

## Planned versus actual (PL-11, honest record)

- Planned: 15 M1 steps with demos per slice. Actual: S-1-01..13 Done-local; S-1-14 partial (demo transcribed; Tier 1 checklist unrun); S-1-15 partial (this audit; review.md holds the design-level AC audit).
- Cut per P1: Refine mode and `metrics.json` moved to M2. Parking lot unchanged.
- Scope added beyond the original M1 plan (by explicit rulings): Interview tab (S-1-12-adjacent), `intent mcp` stdio transport (trd 14.3), init MCP merge (.mcp.json + .cursor/mcp.json), trd 10.1 response envelope, `.intent/.gitignore`, docs/versions.md, smoke checklist reset.
- Defects found late and fixed: SSE replay/resync (TC-SRV-04), /api/patches cursor pagination, mutation-check crash-safety, schema/src/index.ts UTF-16 corruption incident (restored from git, re-applied via node scripts), two 500-line budget overruns (mcp-server, server, schema — split into helpers/event-bus/interview.ts), load-flake in TC-INT-17 (explicit 15s timeouts, assertions unchanged), two lint unused-var failures, one zod unconstrained-array gap (objectIds, fixed), one stale test assumption (ask_user shape ×3), one full verify interruption (server restart during lint — fixed and re-run).
- Deliberate scope discipline: M2/M3 untouched; no push, no tag, no publish, nothing bypassed to look green.

## Handoff (for the next session, per plan §8.7)

0. **Unblock the agent path:** add OpenRouter credits (or point `ANTHROPIC_BASE_URL`/`ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` at a funded Anthropic-compatible endpoint and install/authorize Cursor's `agent` CLI if you want Cursor evidence). Then the one command is ready: `cd <fresh temp project> && claude -p "Design a booking app for my salon" --mcp-config ./.mcp.json --strict-mcp-config --allowedTools mcp__intent__ask_user,mcp__intent__get_scene,mcp__intent__get_feedback,mcp__intent__apply_patch,mcp__intent__validate,mcp__intent__open_studio` — the project init writes `.mcp.json`, `.cursor/mcp.json`, `AGENTS.md` (pointer block) and rules automatically (2026-11-15 fix).
1. **Do not tag or publish.** The gate is NOT READY. Tagging/pushing/publishing is the user's call alone (PL-10, R-B33).
2. Remaining manual work, in order: (a) run Tier 1 smoke against real Claude Code and Cursor (fill tests/smoke/CHECKLIST.md with versions + dates + results); (b) push to a remote and observe CI matrix (ubuntu/macos/windows); (c) run Demo D on a clean machine and the stranger test (3 humans) — record wall-clock and blockers; (d) decide the zod 3→4 migration; (e) fix the 19 audit findings where they touch shipped code (dev-only chain findings may be accepted with a written waiver); (f) then the user may tag v0.1.0.
3. Keep the 12 verify steps green; if anything regresses, the gate goes red again.

## What the user must decide (cannot be decided by the agent)

- Tag v0.1.0? Publish? Push? (all three are the user's call)
- zod 3 → >=4.6.6 migration now or later (GHSA-mrhx-c7xc-m3w5)?
- LICENSE choice for the repo (no LICENSE file exists; no license field in any package.json — deliberately not invented)
- Accept the dev-only audit findings with a written waiver, or fix them?


## Historical snapshot

See `git log --oneline` and the change log in docs/plan.md §19. Earlier RC numbers (379/379 unit, pre-Interview-tab) are superseded by the 2026-11-15 state above.
