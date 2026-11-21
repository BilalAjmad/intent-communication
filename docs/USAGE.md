# Intent User Guide

## Prerequisites

- Node.js >= 20.17 (engines); this repo was built on Node v22.23.4 / pnpm 9.7.1. See `docs/versions.md` for what was verified on 2026-11-15.
- git

## Install

### Option 1 — global auto (no commands in every session)

```powershell
npm install -g <path-to>/intent-studio-1.0.0.tgz
intent --version   # 1.0.0
```

`intent init` in a project merges the MCP server into that project's agent configs;

Optionally also register globally (one time, all agents):
- Claude Code: `claude mcp add --scope user intent -- node <path>/intent.cjs mcp` → `claude mcp list` shows **Connected**
- Cursor: `~/.cursor/mcp.json`, Kilo: `~/.config/kilo/kilo.jsonc`, OpenCode: `~/.config/opencode/opencode.json`, Codex: `~/.codex/config.toml`, Qwen: `~/.qwen/settings.json`, Gemini: `~/.gemini/settings.json` — all get an `intent` stdio entry.
- A marked `Intent (global)` block is appended to each agent's global instruction file (never overwrites).

After this, just open your agent in a project and say: **"Design a booking app for my salon"** — the agent uses the tools automatically.

### Option 2 — slash commands and universal setup

`intent init` writes these into your project (generated from one canonical source, drift-tested):
- `.claude/commands/intent.md`, `.claude/commands/prototype.md`
- `.cursor/commands/intent.mdc`, `.cursor/commands/prototype.mdc`

Use `/intent` **once** at the start of a session (the rules apply for the whole
session — not every message). `/intent` is interview-only: one question at a
time with options plus "Don't know"/"Skip", no hard question limit, every
required topic (`goal, users, screens, flow, style, content`) covered with
stated evidence, ending when you pick "Exactly right" — then the approved brief
is saved to `.intent/briefs/<id>.json`. The meter is an honest estimate and the
server caps it at 89 while a required topic is uncovered; 100 needs real
evidence. 97% belongs to the acceptance-rate target, never to the meter.

Then run `/prototype`: it refuses to run without the approved brief, writes art
direction into scene metadata, opens the Studio, applies your feedback with
`apply_patch` and exports HTML. Agents without slash commands use the `intent:`
and `prototype:` trigger phrases in the AGENTS/rules block instead.

For agents already installed on your machine, run `intent setup` (checklist),
or `intent setup --yes --all`, `--agents claude-code,cursor`, `--scope user`,
`--dry-run`, or `--uninstall`. It merges MCP config + rules + commands,
backing up first and preserving other servers. Only this explicit command may
touch user-level agent config; npm postinstall does not (R-B31). Verified doc
URLs and the UNVERIFIED list are in `docs/versions.md`; unverified agents get
a manual snippet rather than a guessed config edit.

### From a portable tarball (local, built today)

```powershell
# Tarball lives at dist-install/intent-studio-1.0.0.tgz in this repo.
npm install -g <path-to>/intent-studio-1.0.0.tgz
intent --version   # 1.0.0
```

The single-file bundle works from any folder (`intent init`, `intent doctor` verified on a fresh project on 2026-11-19).
To make it installable from GitHub, upload the tarball to a GitHub release (needs owner go-ahead), e.g.:

```powershell
npm install -g https://github.com/BilalAjmad/intent-communication/releases/download/v0.1.0-rc.1/intent-studio-1.0.0.tgz
```

### From source

```powershell
git clone <repo-url> intent
cd intent
pnpm install
pnpm build
```

## Run the CLI through the package bin

### Windows PowerShell

```powershell
node packages/cli/dist/cli.js init
node packages/cli/dist/cli.js doctor
node packages/cli/dist/cli.js export -s default -o my-app.html
```

### macOS / Linux

```bash
node packages/cli/dist/cli.js init
node packages/cli/dist/cli.js doctor
node packages/cli/dist/cli.js export -s default -o my-app.html
```

The CLI bin is `intent` (see `packages/cli/package.json`). After the owner publishes to npm (not done, name unverified):

```bash
npx intent init
```

## In your project

```powershell
node packages/cli/dist/cli.js init --dry-run
node packages/cli/dist/cli.js init
node packages/cli/dist/cli.js doctor
```

### Files created

- `.intent/` — project config, scenes, locks, feedback, interview state
- `AGENTS.md` block — agent rule-file pointer lines (marker blocks, never overwrites user content)
- `.intent/rules/` — generated on-request rule files (`design-principles.md`, `studio.md`)
- `.mcp.json` (repo root) and `.cursor/mcp.json` — the `intent` MCP server merged in (other servers preserved; only the `intent` entry is changed; `--dry-run` writes nothing)

## Connect an agent

These steps come from `docs/versions.md` (checked 2026-11-15 against the official docs). **No live agent session has been driven end-to-end by this repo** — the Tier 1 checklist (tests/smoke/CHECKLIST.md) is deliberately empty; these steps describe what the docs say, not what was observed.

### Claude Code (project scope, `.mcp.json`)

`intent init` merges this entry into `.mcp.json` at the repo root (an entry with no `type` is read as stdio; absolute node path and absolute cli.js path — safe on Windows with spaces):

```json
{ "mcpServers": { "intent": { "command": "<absolute node>", "args": ["<absolute cli.js>", "mcp"] } } }
```

Equivalent by hand, from the docs: `claude mcp add --scope project intent -- <node> <cli.js> mcp`

1. Run `claude` in the project. A project-scoped server from `.mcp.json` is shown as **pending approval** and is NOT connected until you approve it in the interactive session (workspace trust).
2. Approve it, then `claude mcp list` should show it connected, with six tools.
3. Claude Code sets `CLAUDE_PROJECT_DIR` for the spawned server.

### Cursor (project scope, `.cursor/mcp.json`)

`intent init` merges this entry ("type": "stdio" is required):

```json
{ "mcpServers": { "intent": { "type": "stdio", "command": "<absolute node>", "args": ["<absolute cli.js>", "mcp"] } } }
```

1. Run `agent mcp list` — the server is listed with its status and source (project/global). If it is not enabled: `agent mcp enable intent`. Cursor asks before using MCP tools by default.
2. The editor config and the CLI config are the same files.

Manual fallback (both agents) — paste once, not every message (the session keeps the rules):

```
/intent
```
(equivalent long form from `context.md` section 8.4:)

```
Use the Intent rules in this project. Read the "intent" block in AGENTS.md first.
For design or UI work, interview me with the ask_user tool, one question at a time.
```

For visual editing: `/prototype` — switches the session to the Studio workflow.

### Tier 2 agents

"Best effort" — untested, no config shipped.

## First session script

> Honest status: steps involving a live agent have NOT been executed by this repo. They are the intended flow, not measured results. The protocol-level roundtrip (agent asks via `ask_user` → answer in Studio → `get_feedback` returns it once) IS tested over real stdio + the official SDK.

1. Open the agent in your project
2. Say: "Design a booking app for my salon"
3. Answer the interview (numbers, 0 = don't know, s = skip)
4. Approve the summary
5. See the first scene
6. Say: "open the studio"
7. Select an object, send feedback
8. Tell the agent: "check my feedback"
9. Run: `node packages/cli/dist/cli.js export -s default -o my-app.html`
10. Open the file by double-click

## Use the Studio (Interview tab included)

The Studio is a local web app served by `packages/server` at `http://127.0.0.1:<port>/`. It is the same shell the agent opens with `open_studio`.

1. Start the server against your project root (the folder with `.intent/` — see `intent init`):

   ```powershell
   cd path\to\your-project
   $env:INTENT_PROJECT_ROOT = "."
   node path\to\intent-communication\packages\server\dist\start.js
   ```

   or from the intent repo root itself (as a workspace script):

   ```powershell
   pnpm --filter @intent/server start
   ```

   It prints the Studio URL with the session token in the URL fragment, writes `.intent/runtime.json`, and stays up until Ctrl+C.

2. Paste the URL with the token fragment from `.intent/runtime.json` (the token arrives via the URL fragment; never via query string).
3. The shell has three right-panel tabs: **Inspector** (read-only object summary), **Feedback** (text + chips -> draft queue -> Send), and **Interview**.
4. The Interview tab renders whatever question the agent last asked via `ask_user` (`.intent/interview/state.json`). It shows the same content as the plain-text card: question text, numbered options, "0) Don't know, you choose", "s) Skip", an optional "Why am I being asked this?" line, the **Estimated understanding** meter, and topic chips (icon + text: covered / partly / not covered). If a summary is pending, it renders the "Here is what I understood" screen with [you said] / [chosen by me] tags and the three buttons (**Exactly right** / **Change something** / **Ask more questions**).
5. Your answer is saved with `POST /api/interview/answer` and returned to the agent exactly once by `get_feedback` (`interviewAnswers`). A chat answer for the same question that arrives after a Studio answer is ignored.

## Honest section

- **Interview (final master order 2026-11-21):** there is **no hard question limit** — the interview keeps asking, past the soft cap, until every required topic is covered with stated evidence and the user picks "Exactly right". The meter is an honest estimate and the **server caps it at 89 while any required topic is uncovered**; 100 is reachable only from real evidence. The "97–99% acceptance target" belongs to the acceptance-rate story (two numbers: initial match, final match); 97% there is a target, never a claim.
- **Intent makes no network requests. Your coding agent may send scene and
  interview content to its own model provider. No API key is needed for Intent.
- The Interview tab, the SSE replay/resync path and the patch queue are tested and
  pass on this machine (Windows). What is NOT done: a live agent
  end-to-end session (Tier 1 checklist empty), M2/M3 features (drag/resize,
  pencil, Scanner, profile learning, React export), macOS/Linux evidence
  (CI unobserved), and any claim that Intent measures 97-99% intent match.

## Uninstall

- Remove the `intent` entry from `.mcp.json` and `.cursor/mcp.json` (leave your other servers alone).
- Remove the marked blocks in `AGENTS.md`.
- Remove the `.intent/` folder.
If you published nothing (this repo is not published), there is no package to uninstall.
