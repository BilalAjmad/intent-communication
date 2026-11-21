# docs/versions.md — Tool and environment versions

> Read this before wiring up an agent or trusting a claim. Everything not listed
> as verified below is **UNVERIFIED**. Verified items were checked on **2026-11-15**
> against the published documentation (fetched that day), not by running the agents end-to-end.

Date of last check: **2026-11-15** (verified against live docs on this date)
Machine: Windows 11 (this repo's only observed evidence), Node v22.23.4, pnpm 9.7.1

## Verified — Claude Code (Anthropic), MCP

Source (fetched 2026-11-15): https://code.claude.com/docs/en/mcp

- Claude Code reads **project-scoped MCP servers from `.mcp.json` at the repository root**. Add one with `claude mcp add --scope project <name> -- <command> [args...]`. (`--scope` accepts `local` (default), `project`, `user`.)
- A project-scoped server from `.mcp.json` shows as **`⏸ Pending approval (run \`claude\` to approve)`** and is **not connected or health-checked until the user approves it in an interactive `claude` session** (workspace trust). `claude mcp list` and `claude mcp get <name>` show the status.
- In `.mcp.json`, an entry with **no `type` is read as a stdio server** — a stdio entry needs only `command` (and optionally `args`). An entry with a `url` must carry `"type": "http"` (or `sse` / `ws` / `streamable-http`), otherwise it is skipped as a config error.
- `CLAUDE_PROJECT_DIR` is set in the spawned server's environment to the project root.
- `${VAR}` and `${VAR:-default}` expansion is supported in project-scoped `.mcp.json` entries (and local/user-scoped ones in `~/.claude.json`).
- `claude mcp list` shows a health status per server; `/mcp` (in-session) shows approval state and tool counts; disabled servers are recorded per project in `~/.claude.json` (`disabledMcpServers` / `enabledMcpServers`).

## Verified — Cursor, MCP

Sources (fetched 2026-11-15): https://cursor.com/docs/context/mcp and https://cursor.com/docs/cli/mcp

- Cursor reads **project MCP servers from `.cursor/mcp.json`** (in the project root) and **global servers from `~/.cursor/mcp.json`**. Configuration precedence: project → global → nested parent directories.
- A stdio entry requires `"type": "stdio"` and `"command"`; `"args"` is an optional array; `"env"` and `"envFile"` are optional. `command` must be on the system path or a full path.
- `mcp.json` supports **config interpolation**: `${workspaceFolder}` (project root — the folder containing `.cursor/mcp.json`), `${env:NAME}`, `${userHome}`, `${workspaceFolderBasename}`, `${pathSeparator}` / `${/}`. Example: `"args": ["${workspaceFolder}/tools/mcp_server.py"]`.
- Cursor **asks for approval before using MCP tools by default** (approval dialog per tool, with arguments; Run Mode applies — allowlisted tools may run immediately).
- Cursor CLI (the `agent` command): **`agent mcp list`** (interactive menu — names, connected/disconnected status, source project/global, transport), **`agent mcp list-tools <identifier>`**, **`agent mcp enable <identifier>`** (adds the server to the local approved list), `agent mcp disable <identifier>`, `agent mcp login <identifier>`. MCP server names with spaces are supported. `/mcp list` in interactive mode gives the same interface as `agent mcp list`. CLI config = editor config (same files).
- Toggle enable/disable in chat via **Customize**; disabled servers do not load.

## Verified — this repository (Windows 11 only)

- `pnpm verify` 12/12 PASS as of 2026-11-15 (unit 322/322). See `VERIFY-REPORT.md`.
- Full Playwright suite 76/76 PASS as of 2026-11-15.
- TC-INT-17 (3/3), TC-SRV-04 (2/2), TC-STU-08, TC-INT-E2E, axe 0 critical/serious on the Interview tab.

## Dependencies added 2026-11-15

| Package | Version | Date | Licence | Source | Scope |
|---------|---------|------|---------|--------|-------|
| `zod-to-json-schema` | `3.25.2` | 2026-11-15 | ISC | https://registry.npmjs.org/zod-to-json-schema | runtime dependency of `@intent/mcp-server` (derives `tools/list` `inputSchema` from the zod source of truth) |
| `@modelcontextprotocol/sdk` | `1.32.2` | 2026-11-15 | MIT | https://registry.npmjs.org/@modelcontextprotocol/sdk | **devDependency of `@intent/cli` only**; test-only (spawns `intent mcp` as a child process and speaks MCP); never imported by shipped code (context:check passes) |

`pnpm audit` (2026-11-15): 19 findings (1 low, 13 moderate, 2 high, 3 critical). None of them come from the two packages above. All criticals are in the dev/test toolchain (vitest UI server, tinypool); the high in `zod@3.25.76` (GHSA-mrhx-c7xc-m3w5, patched in >=4.6.6) is pre-existing and is **not** fixed here (zod 3 -> 4 is a migration; not in scope). Full output not committed (machine-local).
`pnpm audit` (2026-11-16): 18 findings (1 low, 13 moderate, 1 high, 3 critical), **all in the dev/test toolchain** (vitest, vite, tinypool, launch-editor, esbuild) — none from a shipped runtime dependency of Intent. The zod advisory is closed.
`pnpm audit` (2026-11-16, later): **No known vulnerabilities found.** Closed via: zod 3.25.76 → ^4.6.7 (GHSA-mrhx-c7xc-m3w5); vitest 2.1.9 → 5.1.0 + @vitest/coverage-v8 5.1.0; vite 5.4.21 → 8.3.8 (root + studio); @types/node → ^22; @typescript-eslint → 8.72.2; pnpm override `minimatch@>=7 <11 → ^11.0.1`. All bumps are dev/test toolchain; zero changes to shipped runtime deps. Commit 9ff7419.

## npm package name check — 2026-11-21

Checked against the live registry (`npm view <name> version`, 2026-11-21) in the
order required by the final master order:

| Order | Name | Result |
|-------|------|--------|
| 1 | `intent-studio` | **FREE** — `npm error 404 Not Found ... intent-studio - Not found` |
| 2 | `intent-communication` | FREE — 404 (not used; first free name wins) |
| 3 | `@intent/cli` | FREE — 404 (not used) |

Decision: the published tarball is `intent-studio` (`dist-install/package.json`,
`dist-install/intent-studio-1.0.0.tgz`), with the same `intent` bin. The GitHub
repository remains `BilalAjmad/intent-communication`; only the npm artifact is
renamed. The old local tarball is a superseded build artifact. No publish was
performed by the agent.

## Agent config docs fetched 2026-11-21 (universal installer)

Fetched with the current date 2026-11-21 (verified by `date`). Only these official
pages are marked VERIFIED; everything else is UNVERIFIED with a manual snippet.

| Agent | Official doc URL | Result |
|-------|------------------|--------|
| Claude Code | https://code.claude.com/docs/en/mcp | VERIFIED 2026-11-21 — `.mcp.json` / `~/.claude.json`, stdio entry `{command,args}` with no `type` |
| Cursor | https://cursor.com/docs/context/mcp | VERIFIED 2026-11-21 — `mcp.json`, `mcpServers`, stdio requires `type: "stdio"`; project `.cursor/mcp.json`, global `~/.cursor/mcp.json` |
| Gemini CLI | https://geminicli.com/docs/tools/mcp-server/ | VERIFIED 2026-11-21 — `settings.json` `mcpServers`, user `~/.gemini/settings.json`, project `.gemini/settings.json` |
| GitHub Copilot / VS Code MCP | https://code.visualstudio.com/docs/copilot/chat/mcp-servers | VERIFIED 2026-11-21 — workspace `.mcp.json` for shared config; personal config is Copilot Global |
| OpenCode | https://opencode.ai/docs/mcp | UNVERIFIED 2026-11-21 — both `/docs/mcp` and `/docs/mcp/` returned 404 to this fetch; config key (`mcp` vs `mcpServers`) not confirmed |
| Windsurf, Cline, Roo Code, Kilo Code, Codex CLI, Zed, Continue, Amp, Goose, JetBrains AI, Claude Desktop | URLs in each adapter header under `packages/cli/src/setup/adapters/` | UNVERIFIED 2026-11-21 — paths/config formats are not claimed; installer prints a manual snippet instead of asserting correctness |

The six-tool MCP contract was checked against a **real spawned client** in
`packages/cli/src/setup/setup.test.ts`: entries written by the Claude Code,
Cursor and Gemini CLI adapters all launch the same server and `tools/list`
returns exactly `apply_patch`, `ask_user`, `get_feedback`, `get_scene`,
`open_studio`, `validate`.

## UNVERIFIED — do not claim until checked

Everything not listed above is unverified, including but not limited to:

- **No live Claude Code or Cursor session has been driven end-to-end by this repository.** The Tier 1 smoke checklist (`tests/smoke/CHECKLIST.md`) is deliberately empty; no tool versions for either agent have been recorded by this repo.
- Whether either agent accepts this repo's exact merged `.mcp.json` / `.cursor/mcp.json` entries **as written by `intent init`** — the merge is unit-tested, but the agents themselves have not been run against it (the steps above describe what the docs say, not what we observed).
- Claude Code `--version`, Cursor version, Node versions beyond this machine, `claude mcp add --scope project` exact output text, Cursor's behavior with `${workspaceFolder}` on Windows paths with spaces.
- Tier 2 agents (Kilo, Cline, others), macOS and Linux runs, CI (configured, unobserved), 97–99% intent match, npm publishing (`intent` bin unverified on a clean machine).
- Refine mode / `metrics.json` (deferred to M2), all M2/M3 features.
- Whether `claude mcp add --scope project` is the preferred path for teams vs. committing `.mcp.json` by hand — this repo only documents the `.mcp.json` path because it is the one the init merge writes.
- Protocol negotiation behavior of `intent mcp` against Claude Code's v2 runtime (Claude Code asks for the 2026-07-28 revision; if the server does not support it, the connection runs as v1 — per https://code.claude.com/docs/en/mcp, unchanged by this repo).

## How to update this file

Run the check against live docs, re-fetch the three URLs above, re-run `date`,
and mark only what you verified. Do not promote an UNVERIFIED item to verified
because "it worked last time" or because it sounded right.
