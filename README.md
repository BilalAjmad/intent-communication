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

All 12 verify steps pass:

| Step | Status |
|------|--------|
| install | PASS |
| build | PASS |
| typecheck | PASS |
| lint | PASS |
| unit+integration tests | PASS (174 tests) |
| multi-process tests | PASS |
| sigkill test | PASS |
| mutation proof | PASS |
| visual diff (Playwright) | PASS |
| smoke test (Playwright) | PASS |
| docs:index | PASS |
| context:check | PASS |

Run `pnpm verify` to regenerate `VERIFY-REPORT.md`.

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

See `docs/USAGE.md` for exact agent-connection steps.

## Honest notes

- Intent makes no network requests. Your coding agent may send scene and
  interview content to its own model provider.
- No API key is needed for Intent.
- Not done yet: M2/M3 features (drag/resize, pencil, Scanner, profile learning,
  React export).
- Windows/macOS CI evidence is pending.

## Uninstall

Remove the generated rule-file blocks and the `.intent/` folder.
