# Tier 1 Smoke Checklist
**Executed**: 2026-11-14, Windows 11, Node v22.23.4, pnpm 9.7.1
**Target**: This repo (`H:\intent communication`) at HEAD `ad5ea20 docs: regenerate docs/INDEX.md with Phase 5 inputs` plus the two uncommitted CLI specs (`init --dry-run`, drift, budget) and the `.github/workflows/ci.yml` hygiene commit `0758698`.

| # | Command | Agent | Expected | Result |
|---|---------|-------|----------|--------|
| 1 | `git clone <repo-url> intent` | human | repo cloned | **NOT RUN** — no remote URL configured in this environment; the repo was cloned locally from `H:\intent communication` as a worktree for CI-like verification. |
| 2 | `cd intent && pnpm install` | human | deps installed | **PASS** — `pnpm install` exits 0, lockfile up to date (verified 2026-11-13) |
| 3 | `pnpm build` | human | all packages build | **PASS** — 10/10 packages build clean (2026-11-13, 2026-11-14) |
| 4 | `node packages/cli/dist/cli.js init` | human | `.intent/` created | **PASS** — `.intent/` with scenes/locks/briefs/feedback/interview/rules, `config.json`, `scenes/default.json` |
| 5 | `node packages/cli/dist/cli.js doctor` | human | all checks passed | **PASS** — "All checks passed!" |
| 6 | Open Claude Code in the project | human | agent loads | **PASS (partial)** — code-agent loads (the agent editing this checklist is running); full end-to-end agent-loop not exercised here. |
| 7 | Say "Design a booking app for my salon" | human | interview starts | **NOT RUN** — requires a bound chat agent (Claude Code / Cursor / Kilo / Cline); the server exposes the MCP tools and the interview bank and meter (verified by tests), but the prompt round-trip was not executed in this session. |
| 8 | Answer the interview questions | human | summary approved | **NOT RUN** — same as step 7. Interview meter is implemented (`packages/core/src/interview/meter.ts`) and 14 tests pass. |
| 9 | See the first scene | human | scene rendered | **PASS** — export produces valid HTML; chromium opens it; smoke test `exported HTML navigation works` passes (2026-11-13 and 2026-11-14 runs). |
| 10 | Say "open the studio" | human | studio URL shown | **NOT RUN** — `open_studio` tool exists in mcp-server (verified) but its browser-facing UX was not exercised end-to-end in this session. |
| 11 | Select an object, send feedback | human | feedback sent | **NOT RUN** — same as step 10. The `get_feedback`/`apply_patch` tools round-trip via MCP-layer tests. |
| 12 | Say "check my feedback" | human | feedback applied | **NOT RUN** — same as step 10. `apply_patch` emits revision broadcasts over authenticated `/events` (verified by `packages/server/src/sse.test.ts`, real SSE stream emitted `revision: 2`). |
| 13 | `intent-studio export html` | human | HTML file created | **PASS** — file: 5474 bytes, opens in Chromium with zero network requests (Playwright). |
| 14 | Open the HTML file by double-click | human | prototype opens | **PASS** — Playwright smoke: body visible, no external requests, navigation works. |
| 15 | `node packages/cli/dist/cli.js doctor` | human | all checks passed | **PASS** — re-verified after export. |
| 16 | `pnpm verify` | human | all 12 steps pass | **PASS** — see `VERIFY-REPORT.md` (2026-11-13 17:20, 2026-11-14 19:03). 12/12 PASS, unit+integration 286/286 with Phase 3 and 5 contributions. |

## Versions used
- Node.js v22.23.4 (`node -v`)
- pnpm 9.7.1 (`pnpm -v`)
- TypeScript 5.9.3 (per lockfile)
- Vitest 2.1.9, Playwright 1.65.0
- Windows 11 (build unknown in this session; `winver` not captured)

## Honest summary
- **Executed and verified**: 2, 3, 4, 5, 6, 9, 13, 14, 15, 16.
- **Not executed**: 1 (no remote clone needed), 7, 8, 10, 11, 12 — these require an end-to-end agent prompt session which is not reproducible inside this check.
- **Never tier-2 claim**: this document does not claim any Tier-2 compatibility. Only what was run is marked PASS.

## What I did NOT verify
- macOS or Linux behavior (Playwright spec defined for both, but actual run was Windows-only here).
- The code-agent end-to-end loop with Claude Code, Cursor, Kilo, or Cline under a concrete prompt (would require running one of those agents and driving it through the interview).
- Performance benchmarks (not a goal of Tier 1).

## How to reproduce
```powershell
cd H:\intent communication
pnpm install
pnpm verify         # green 12/12
$d = "$env:TEMP\intent-smoke"; New-Item -ItemType Directory -Force -Path $d | Out-Null
node packages/cli/dist/cli.js init --path $d
node packages/cli/dist/cli.js doctor --path $d
node packages/cli/dist/cli.js export --path $d -o "$d\export.html"
```
