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
9. Run: `node packages/cli/dist/cli.js export -s default -o my-app.html`
10. Open the file by double-click

## Use the Studio (Interview tab included)

The Studio is a local web app served by `packages/server` at `http://127.0.0.1:<port>/`. It is the same shell the agent opens with `open_studio`.

1. Start the server (or say "open the studio" to the agent):

   ```powershell
   pnpm --filter @intent/server start   # prints the URL; .intent/runtime.json holds port + token
   ```

2. Paste the URL with the token fragment from `.intent/runtime.json` (the token arrives via the URL fragment; never via query string).
3. The shell has three right-panel tabs: **Inspector** (read-only object summary), **Feedback** (text + chips -> draft queue -> Send), and **Interview**.
4. The Interview tab renders whatever question the agent last asked via `ask_user` (`.intent/interview/state.json`). It shows the same content as the plain-text card: question text, numbered options, "0) Don't know, you choose", "s) Skip", an optional "Why am I being asked this?" line, the **Estimated understanding** meter, and topic chips (icon + text: covered / partly / not covered). If a summary is pending, it renders the "Here is what I understood" screen with [you said] / [chosen by me] tags and the three buttons (**Exactly right** / **Change something** / **Ask more questions**).
5. Your answer is saved with `POST /api/interview/answer` and returned to the agent exactly once by `get_feedback` (`interviewAnswers`). A chat answer for the same question that arrives after a Studio answer is ignored.

## Honest section

- Intent makes no network requests. Your coding agent may send scene and
  interview content to its own model provider. No API key is needed for Intent.
- The Interview tab, the SSE replay/resync path and the patch queue are tested and
  pass on this machine (Windows). What is NOT done: a live agent
  end-to-end session (Tier 1 checklist empty), M2/M3 features (drag/resize,
  pencil, Scanner, profile learning, React export), macOS/Linux evidence
  (CI unobserved), and any claim that Intent measures 97-99% intent match.

## Uninstall

Remove the marked blocks in `AGENTS.md` and the `.intent/` folder.
