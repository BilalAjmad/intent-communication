# Intent User Guide

## Prerequisites

- Node.js 22 LTS (verified range in `docs/versions.md` — **UNVERIFIED**: file does not exist yet)
- git

## Install

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

After the owner publishes to npm (not done, package name unverified):

```bash
npx intent-studio init
```

## In your project

```powershell
intent-studio init --dry-run
intent-studio init
intent-studio doctor
```

### Files created

- `.intent/` — project config, scenes, locks, feedback, interview state
- `AGENTS.md` block — agent rule-file pointer lines (marker blocks, never overwrites user content)
- `.intent/rules/` — generated on-request rule files (`design-principles.md`, `studio.md`)
- MCP config entry — added to your agent's MCP configuration

## Connect an agent

### Claude Code and Cursor (Tier 1)

Exact MCP config and rules steps are taken from `docs/versions.md` (**UNVERIFIED**: file does not exist yet).

Manual fallback — paste this trigger line from `context.md` section 8.4:

```
Use the Intent rules in this project. Read the "intent" block in AGENTS.md first.
For design or UI work, interview me with the ask_user tool, one question at a time.
```

### Tier 2 agents

"Best effort" — untested.

## First session script

1. Open the agent in your project
2. Say: "Design a booking app for my salon"
3. Answer the interview (numbers, 0 = don't know, s = skip)
4. Approve the summary
5. See the first scene
6. Say: "open the studio"
7. Select an object, send feedback
8. Tell the agent: "check my feedback"
9. Run: `intent-studio export html`
10. Open the file by double-click

## Honest section

- Intent makes no network requests. Your coding agent may send scene and
  interview content to its own model provider. No API key is needed for Intent.
- Not done yet: M2/M3 features (drag/resize, pencil, Scanner, profile learning,
  React export). Windows/macOS evidence unless CI shows it.

## Uninstall

Remove the marked blocks in `AGENTS.md` and the `.intent/` folder.
