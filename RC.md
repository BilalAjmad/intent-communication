# Intent — Release Candidate Status

Date: 2026-11-15
Scope: M1, in-tree state at the current working tree after the Interview-tab pass (SCHEMA/MCP/server/Studio). Nothing has been pushed or tagged.

> **The M1 gate verdict remains NOT READY for v0.1.0** (docs/review.md A-21/A-21.1). This file states what is proven and what is not. Do not read "works" below as a release claim.

## What works (verified with evidence, this tree)

- **All 12 verify steps pass** on this machine (Windows 11, Node v22.23.4, pnpm 9.7.1): install, build (10/10), typecheck, lint, unit+integration **379/379**, multi-process 2/2, sigkill 1/1, mutation proof 5/5, visual diff 6/6, smoke 5/5, docs:index, context:check. See `VERIFY-REPORT.md` (regenerated; gitignored).
- **Full Playwright suite: 76/76** on Windows 11 (includes visual-diff pixel comparisons, smoke, fidelity-pixel, keyboard-only flow, and the new interview-tab and axe specs).
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

- **The M1 gate has not been executed** (plan §8.7, S-1-15: Partial). Do not tag v0.1.0, do not publish.
- **Agent end-to-end interview is NOT exercised here.** No live Claude Code / Cursor session drove the interview. The Tier 1 smoke checklist (tests/smoke/CHECKLIST.md) is intentionally **empty** — nothing has been run against a real agent, no version recorded.
- **97–99% intent match is an unmeasured target**, not a measured result. The meter is implemented (capped-89 rule) and golden-tested offline, but no production session has produced the acceptance number.
- **Agent connection steps for Claude Code and Cursor are UNVERIFIED** — `docs/versions.md` does not exist. README and USAGE must be read with that caveat.
- **macOS/Linux have never been executed.** CI (ubuntu/windows/macos matrix) is configured but has not been observed to run here. Fidelity calibration is Windows-only.
- **Interview summary "Change something"** edits items in the DOM as contenteditable but there is no diff/confirmation path for the edited items; `Exactly right` marks the interview `complete`. `Ask more questions` records `summaryChoice: "ask-more"` and keeps the interview in progress.
- **Refine mode and metrics.json are deferred to M2** (P1 cut).
- **M2/M3 features** (drag/resize, pencil annotations, pins, unread/pinned, profile learning, Scanner) are not built.
- **The Studio SPA deep-link fallback is deliberately absent** — unknown paths return 404; the SPA is served at `/` only.
- **An interrupted verify run can leave `packages/core/src/patch.ts` restored from git**; `scripts/mutation-check.mjs` is crash-safe (backup + self-heal) since 2026-11-14, but the class of failure exists.
- **The summary "Change something" path is not automated-tested** — no Playwright or unit test exercises the edited-items branch (`contenteditable` → `save-summary-changes`); only the code path is written. Do not claim it works until a test exists.

## Risks

- **Status “applied” without agent verification**: `apply_patch` marks feedback `applied` on success — the agent could mark its own patch applied; the Studio has no independent verifier. (Mitigation today: human reads the diff; colors/tray are advisory only.)
- **Stale locks can expire while a holder is paused** (>10 s stale reclaim): a suspended OS or a long GC pause can have its lock reclaimed underneath it. Untested on real sleep/wake cycles.
- **SSE fan-out is in-memory, single process**: a server restart silently drops the ring and replayed history; clients must treat `resync` as a full reload. No persistence of `.intent/events` beyond the current process.
- **`.intent/interview/state.json` is rewritten wholesale** on every `ask_user`/answer; a concurrent external edit between read and write is lost. Atomic writes prevent torn files, not lost updates.
- **The SPA CSP pins the two constant preview inline scripts by sha256**: any change to those scripts breaks the preview silently unless the hashes in both policies are regenerated (no automation for this).
- **Pixel fidelity thresholds are zero**; a font or rasterizer difference on a different OS would fail CI without a recalibration. CI is unobserved.
- **All evidence is this one Windows machine** (plus whatever CI shows later). No clean-machine run has happened.
- **No push / no tag / no release has happened.** The user decides.

- **zod@3.25.76 is flagged by `pnpm audit` (GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404, high, < 4.6.6, patched >= 4.6.6).** Mechanism: `$ZodArray` accumulates every per-element validation issue with no cap. Mitigated (not fixed) by the 1 MiB stdio line cap and `objectIds` now `.max(50)`; all other arrays were already `.max()`-bounded. **The full fix (zod >= 4.6.6, a 3→4 migration) is NOT applied — needs your approval.** The advisory remains visible in `pnpm audit`.

## Historical snapshot

See `git log --oneline` and the change log in docs/plan.md §19. Earlier RC numbers (379/379 unit, pre-Interview-tab) are superseded by the 2026-11-15 state above.
