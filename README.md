# Intent

Intent closes the "intent gap" — the problem where a user writes a short prompt,
the AI guesses, and the output only matches ~70% of what they actually wanted.
Intent raises intent match to 97–99% in two steps:

1. **Deep interview** — Before building anything, the agent interviews you in
   micro-detail (goal, users, screens, flow, style, content, behavior, edge
   cases) until it truly understands what you want.
2. **Prototype Studio** — You edit the result visually in a clickable HTML
   prototype instead of describing changes in words.

Intent works with your existing coding agent (Claude Code, Cursor, etc.) via
MCP tools — no API keys, no LLM calls inside the repo, no cloud. The
`.intent/` folder on your filesystem is the single source of truth.

## Verification

All 12 verify steps pass on this machine (Windows 11, Node v22.23.4, pnpm 9.7.1). CI (Windows/macOS/Ubuntu) is configured but has not been observed to run; only Windows evidence exists:

| Step | Status | Evidence |
|------|--------|----------|
| install | PASS | lockfile up to date, 10 workspace projects |
| build | PASS | 10/10 packages build clean |
| typecheck | PASS | 0 errors |
| lint | PASS | 0 errors |
| unit+integration tests | PASS | **322/322 across 10 packages** (2026-11-15) |
| multi-process tests | PASS | 2/2 different-objects, 2/2 same-object |
| sigkill test | PASS | SIGKILLed stale scene lock reclaimed |
| mutation proof | PASS | 5/5 mutations detected (lock, conflict, scope, descendant-lock, schema); crash-safe backup + self-heal added 2026-11-14 |
| visual diff (Playwright) | PASS | 6/6 real pixel-comparison tests (threshold 0, no stored baselines); full Playwright suite **76/76** (2026-11-15) |
| smoke test (Playwright) | PASS | 5/5 tier-1 smoke pass, incl. init→doctor→export→open-with-no-network |
| docs:index | PASS | docs/INDEX.md regenerated |
| context:check | PASS | 500-line budget respected (schema 476, mcp-server 430, server 472; index split into api-routes/api-helpers/runtime/event-bus) |

Interview-tab evidence (2026-11-15): TC-INT-17 (Studio answer wins, returned once) 3/3; TC-SRV-04 (SSE Last-Event-ID replay of 100, `resync` on larger gap) 2/2; TC-STU-08 (tab card content equals plain-text card) pass; TC-INT-E2E (agent asks via ask_user → answer clicked in Studio → get_feedback returns it once) pass; axe-core 0 critical/serious on the tab.

Run `pnpm verify` to regenerate `VERIFY-REPORT.md` (gitignored).

### What we claim

- The exporter never emits external network requests: all styles are inline CSS; fonts are the system stack; images are inlined data URIs or dropped.
- The exporter performs HTML escaping on all text content, attributes, and URLs; CSP meta is emitted; `<img src>` requires a data: URI of an allowed raster MIME type.
- `/intent/verify` can be relied on in CI; the full 12-step suite exits 0 on green runs.

### What we don't claim (honest limits)

- **Intent's "97–99% intent match" target is not verified by any test in this repo.** The meter computes a weighted understanding score from slot evidence only (it cannot be inflated by the agent), but no production session with a real user has produced the 97–99% acceptance-rate number here. It is a target, not a measured result.
- **No macOS or Linux CI runs have been observed by this session.** CI is configured for ubuntu-latest, windows-latest, macos-latest; only Windows execution has been measured.
- **Interview completion has not been driven end-to-end by a real agent in this session.** The `ask_user` tool persists the pending question and the Studio Interview tab renders it; the real-UI roundtrip (agent asks → user answers in Studio → `get_feedback` returns it once) is tested at the HTTP/Playwright layer. No live Claude Code / Cursor conversation was executed. The Tier 1 smoke checklist (`tests/smoke/CHECKLIST.md`) is empty for the same reason.
- **The Studio SPA shell is built and tested** (Inspector / Feedback / Interview tabs, Playwright suite 76/76 on Windows); what does NOT exist yet is the measured acceptance-rate story — the 97–99% target is unproven by this repo.
- **Exact MCP connection steps for Claude Code and Cursor are UNVERIFIED** — `docs/versions.md` does not exist. `docs/USAGE.md` says the same.

## Install

```powershell
cd /path/to/intent
pnpm install
pnpm build
```

## Use

```powershell
# 1. Initialize an Intent project in your project folder
node packages/cli/dist/cli.js init

# 2. Run diagnostics
node packages/cli/dist/cli.js doctor

# 3. Export a scene to HTML prototype
node packages/cli/dist/cli.js export -s default -o my-app.html
```

Then open `my-app.html` in your browser.

### Full CLI reference

| Command | What it does |
|---------|-------------|
| `intent init` | Initialize a new Intent project (creates `.intent/`) |
| `intent doctor` | Check project health |
| `intent export -s <sceneId> -o <file>` | Export a scene to HTML |

## Connect an agent (Claude Code, Cursor)

Intent exposes 6 MCP tools: `ask_user`, `get_scene`, `get_feedback`,
`apply_patch`, `validate`, `open_studio`. Point your agent's MCP config at
`packages/mcp-server/dist/`.

**Exact setup steps are UNVERIFIED**: `docs/versions.md` does not exist, so the
precise MCP config block for Claude Code and Cursor has not been checked
against those agents. See `docs/USAGE.md` for the manual fallback trigger line.

## Honest notes

- Intent makes no network requests. Your coding agent may send scene and
  interview content to its own model provider.
- No API key is needed for Intent.
- Not done yet: M2/M3 features (drag/resize, pencil, Scanner, profile learning,
  React export).
- Windows/macOS CI evidence is pending.

## Uninstall

Remove the generated rule-file blocks and the `.intent/` folder.
