# Intent

Intent closes the "intent gap" — the problem where a user writes a short prompt,
the AI guesses, and the output only matches ~70% of what they actually wanted.

## Two ways to use it

**Option 1 — Global auto (recommended, no slash commands).** Install once, and every
configured AI agent on this machine follows Intent rules automatically for all
design/UI work: it interviews you one question at a time, and you edit visually in
the Studio. No command to type per session. See `docs/USAGE.md`.

**Option 2 — Slash commands (`/intent`, `/prototype`).** Paste `/intent` **once at
the start of a conversation** — the agent then follows the interview rules for the
whole session (no need to paste it in every message). `/prototype` switches the
same session to visual Studio editing. `intent init` writes both commands into
`.claude/commands/` and `.cursor/commands/` of your project; they are also
installed globally for the agents on this machine.

These two options are independent: you can use only one, or both (they are the
same rules underneath).

Intent raises intent match toward a **97–99% target** in two steps:

1. **Deep interview** — Before building anything, the agent interviews you in
   micro-detail (goal, users, screens, flow, style, content, behavior, edge
   cases) until it truly understands what you want.
2. **Prototype Studio** — You edit the result visually in a clickable HTML
   prototype instead of describing changes in words.

Intent works with your existing coding agent (Claude Code, Cursor, etc.) via
MCP tools — no API keys, no LLM calls inside the repo, no cloud. The
`.intent/` folder on your filesystem is the single source of truth.

### Universal setup (explicit command only)

`intent setup` detects installed agents and shows a preselected checklist. It
merges the `intent` MCP entry, rules and slash-command files for each selected
agent, backs up before every write, preserves other config keys, and prints a
final table. Flags: `--yes --all --agents a,b --scope user|project --dry-run
--uninstall`. Only this **explicit** command may edit user-level agent config;
npm lifecycle scripts never do (rule R-B31). Agents whose config format could
not be verified on 2026-11-21 get a manual snippet instead of a guessed edit;
see `docs/versions.md`.

In a project, `/intent` runs the interview only (one question at a time, no
hard limit, server meter capped at 89 while a required topic is uncovered).
It ends by saving `.intent/briefs/<id>.json`. `/prototype` requires that
approved brief, writes art direction into scene metadata, opens the Studio and
exports HTML. Both come from one canonical source in `@intent/skills` and are
drift-tested; agents without slash commands get `intent:` / `prototype:` triggers.
The anti-AI-slop rules in `.intent/rules/design-principles.md` are enforced by
the linter where possible; they reduce generic output but cannot guarantee taste.

## Verification

All 12 verify steps pass on this machine (Windows 11, Node v22.23.4, pnpm 9.7.1), and CI (Ubuntu/macOS/Windows × Node 20) was **observed green on this repo as of 2026-11-18** (run `44371953296`: install → build → typecheck → test on all three OS images, Playwright e2e on Ubuntu — after root-causing a Linux build-order failure and two Linux-specific e2e defects; `44369132170` had the e2e failure, `44368167556` the build-order failure). Earlier snapshots claiming Windows-only evidence are outdated.

| Step | Status | Evidence |
|------|--------|----------|
| install | PASS | lockfile up to date, 10 workspace projects |
| build | PASS | 10/10 packages build clean |
| typecheck | PASS | 0 errors |
| lint | PASS | 0 errors |
| unit+integration tests | PASS | **683/683 across 10 packages** (2026-11-18) |
| multi-process tests | PASS | 2/2 different-objects, 2/2 same-object |
| sigkill test | PASS | SIGKILLed stale scene lock reclaimed |
| mutation proof | PASS | 5/5 mutations detected (lock, conflict, scope, descendant-lock, schema) |
| visual diff (Playwright) | PASS | visual pixel-comparison tests pass (threshold 0, no stored baselines); full Playwright suite **102/102** (2026-11-18) |
| smoke test (Playwright) | PASS | tier-1 smoke pass, incl. init→doctor→export→open-with-no-network |
| docs:index | PASS | docs/INDEX.md regenerated |
| context:check | PASS | 500-line budget respected (run `pnpm context:check` for the live report) |

Interview-tab evidence (2026-11-15): TC-INT-17 (Studio answer wins, returned once) 3/3; TC-SRV-04 (SSE Last-Event-ID replay of 100, `resync` on larger gap) 2/2; TC-STU-08 (tab card content equals plain-text card) pass; TC-INT-E2E (agent asks via ask_user → answer clicked in Studio → get_feedback returns it once) pass; axe-core 0 critical/serious on the tab.

Stdio MCP evidence (2026-11-15): `intent mcp` (trd 14.3) starts the MCP server on stdio; a real `@modelcontextprotocol/sdk` client lists **exactly the six tools** over stdio, and stdout carries only protocol messages (stderr empty). `tools/list` `inputSchema` derives from the Zod source of truth (`validate` is the documented hand-written exception; see tool-schemas.test.ts) and every generated schema round-trips a valid and an invalid example (ajv, test-only). `intent init` merges the `intent` server into `.mcp.json` (Claude Code) and `.cursor/mcp.json` (Cursor): other servers preserved, only the `intent` entry changed, idempotent, `--dry-run` writes nothing, absolute node/cli.js paths (spaces-safe on Windows). Tool descriptions ≤120 words each, ≤700 total (trd 10.1).

Run `pnpm verify` to regenerate `VERIFY-REPORT.md` (gitignored).

### What we claim

- The exporter never emits external network requests: all styles are inline CSS; fonts are the system stack; images are inlined data URIs or dropped.
- The exporter performs HTML escaping on all text content, attributes, and URLs; CSP meta is emitted; `<img src>` requires a data: URI of an allowed raster MIME type.
- `/intent/verify` can be relied on in CI; the full 12-step suite exits 0 on green runs.

### What we don't claim (honest limits)

- **The interview has no hard question limit (final master order 2026-11-21).** It keeps asking — past any soft cap — until every required topic is covered and the user picks "Exactly right". The meter is honest: the server caps it at **89** while any required topic is uncovered, and 100 is reachable only from real evidence (`reason` names a still-uncovered topic). The "97–99%" figure belongs to the acceptance-rate target, not to the interview meter, and is never claimed as a measured result.
- **Intent's "97–99% intent match" target is not verified by any test in this repo.** The meter computes a weighted understanding score from slot evidence only (it cannot be inflated by the agent), but no production session with a real user has produced the 97–99% acceptance-rate number here. It is a target, not a measured result.
- **CI is observed green, but only for the runs listed above.** GitHub forces Actions onto the Node 24 runtime (Node 20 deprecated) and prints annotations to that effect; these are warnings, not failures. No macOS/Ubuntu benchmark re-measurement has been done (the bench tripwires are CI-host-relative, see `bench.test.ts` and `docs/security.md`).
- **Interview completion has not been driven end-to-end by a real agent in this session.** The `ask_user` tool persists the pending question and the Studio Interview tab renders it; the real-UI roundtrip (agent asks → user answers in Studio → `get_feedback` returns it once) is tested at the HTTP/Playwright layer, and a scripted-agent simulator runs full interviews through the real handler (`interview-simulator.test.ts`). No live Claude Code / Cursor conversation was executed. The Tier 1 smoke checklist (`tests/smoke/CHECKLIST.md`) is empty for the same reason.
- **The Studio SPA shell is built and tested** (Inspector / Feedback / Interview tabs, Playwright suite 102/102); what does NOT exist yet is the measured acceptance-rate story — the 97–99% target is unproven by this repo.
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
- M2/M3 features are all landed and tested (drag/resize, animations +
  @keyframes editor, React export, Scanner + design profile, Intent Profile
  learning, acceptance-rate metric, interview metrics, file watcher,
  output-schema enforcement). What's left: publish/release (owner-gated),
  the human-trial acceptance measurement, and npm publishing (not done).
- CI (Ubuntu/macOS/Windows) is green on this repo as of 2026-11-18; see the
  verification table for the exact runs.

## Uninstall

1. Remove the `intent` entry from `.mcp.json` and `.cursor/mcp.json` (keep your other servers).
2. Remove the generated rule-file blocks from `AGENTS.md` (and any pointer blocks this repo added).
3. Delete `.intent/`.
4. It is not published to npm, so there is no package to uninstall yet.
