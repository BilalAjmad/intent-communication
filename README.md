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
| unit+integration tests | PASS | **379/379 across 10 packages** (2026-11-15) |
| multi-process tests | PASS | 2/2 different-objects, 2/2 same-object |
| sigkill test | PASS | SIGKILLed stale scene lock reclaimed |
| mutation proof | PASS | 5/5 mutations detected (lock, conflict, scope, descendant-lock, schema); crash-safe backup + self-heal added 2026-11-14 |
| visual diff (Playwright) | PASS | 6/6 real pixel-comparison tests (threshold 0, no stored baselines); full Playwright suite **76/76** (2026-11-15) |
| smoke test (Playwright) | PASS | 5/5 tier-1 smoke pass, incl. init→doctor→export→open-with-no-network |
| docs:index | PASS | docs/INDEX.md regenerated |
| context:check | PASS | 500-line budget respected (schema 476, mcp-server 464, server 472; index split into api-routes/api-helpers/runtime/event-bus) |

Interview-tab evidence (2026-11-15): TC-INT-17 (Studio answer wins, returned once) 3/3; TC-SRV-04 (SSE Last-Event-ID replay of 100, `resync` on larger gap) 2/2; TC-STU-08 (tab card content equals plain-text card) pass; TC-INT-E2E (agent asks via ask_user → answer clicked in Studio → get_feedback returns it once) pass; axe-core 0 critical/serious on the tab.

Stdio MCP evidence (2026-11-15): `intent mcp` (trd 14.3) starts the MCP server on stdio; a real `@modelcontextprotocol/sdk` client lists **exactly the six tools** over stdio, and stdout carries only protocol messages (stderr empty). `tools/list` `inputSchema` derives from the Zod source of truth (`validate` is the documented hand-written exception; see tool-schemas.test.ts) and every generated schema round-trips a valid and an invalid example (ajv, test-only). `intent init` merges the `intent` server into `.mcp.json` (Claude Code) and `.cursor/mcp.json` (Cursor): other servers preserved, only the `intent` entry changed, idempotent, `--dry-run` writes nothing, absolute node/cli.js paths (spaces-safe on Windows). Tool descriptions ≤120 words each, ≤700 total (trd 10.1).

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
- **No live Claude Code or Cursor session has been driven end-to-end by this repo.** The connection steps are verified against the official docs (2026-11-15, see `docs/versions.md`), and `intent mcp` round-trips tools with a real MCP client over stdio — but the agents themselves have not been observed running this repo's tools; the Tier 1 checklist (`tests/smoke/CHECKLIST.md`) is empty.

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

Intent exposes 6 MCP tools over stdio (`intent mcp`): `ask_user`, `get_scene`, `get_feedback`, `apply_patch`, `validate`, `open_studio`. `intent init` already merged the server into both agent configs for you (project scope); the steps below are what the docs say to do from there. Checked 2026-11-15; see `docs/versions.md`. **No live agent session has been run by this repo.**

### Claude Code (project scope)

1. `intent init` has written `.mcp.json` at the repo root — entry: `{"command": "<absolute node>", "args": ["<absolute cli.js>", "mcp"]}` (no `type` = stdio). Equivalent by hand: `claude mcp add --scope project intent -- <node> <cli.js> mcp`.
2. Run `claude` in the project. The server shows as **pending approval**; approve it in the interactive session (workspace trust). Nothing is connected before you do.
3. `claude mcp list` shows it connected with six tools. `CLAUDE_PROJECT_DIR` is set for the spawned server.

### Cursor (project scope)

1. `intent init` has written `.cursor/mcp.json` — entry: `{"type": "stdio", "command": "<absolute node>", "args": ["<absolute cli.js>", "mcp"]}`.
2. `agent mcp list` shows the server and its status; if not enabled: `agent mcp enable intent`. Cursor asks before using MCP tools by default. Editor and CLI share the same files.

See `docs/USAGE.md` for the first-session script and the manual trigger line.

## Honest notes

- Intent makes no network requests. Your coding agent may send scene and
  interview content to its own model provider.
- No API key is needed for Intent.
- Not done yet: M2/M3 features (drag/resize, pencil, Scanner, profile learning,
  React export).
- Windows/macOS CI evidence is pending.

## Uninstall

1. Remove the `intent` entry from `.mcp.json` and `.cursor/mcp.json` (keep your other servers).
2. Remove the generated rule-file blocks from `AGENTS.md` (and any pointer blocks this repo added).
3. Delete `.intent/`.
4. It is not published to npm, so there is no package to uninstall yet.
