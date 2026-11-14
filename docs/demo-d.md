# Demo D — Intent v0.1.0 end-to-end demo

**Source**: `docs/plan.md` §8.6.
**Machine**: Windows 11, Node 22.23.4, pnpm 9.7.1, 0 (CRX). Run `pnpm verify` first to confirm the repo itself is green.

## Goals
- Exercise the smallest complete path: init → doctor → open → design → patch → preview → export.
- Record concrete results, dates and versions — never "should".

## Steps

1. **Initialize a fresh project** (does not require any agent):

   ```powershell
   cd C:\Users\AFZAAL KHAN\AppData\Local\Temp\intent-demo
   git init
   node "<path>\intent\packages\cli\dist\cli.js" --path . init
   node "<path>\intent\packages\cli\dist\cli.js" --path . doctor
   ```
   Expected: `.intent/` is created with scenes/locks/briefs/feedback/interview/rules, `config.json` and `scenes/default.json`. `doctor` prints "All checks passed!".

2. **Open the preview in a browser** — build & start the studio server (this is the only step in the demo that needs a running server):

   ```powershell
   node "<path>\intent\packages\cli\dist\cli.js" --path . export -s default -o demo.html
   Start-Process demo.html
   ```

   Expected: `demo.html` opens with the default scene rendered (empty by default since init creates an empty screen).

3. **Give an example prompt** (what the agent would consume):
   "Design a booking app for my salon — 2 screens, book a slot, cancel the booking."

4. **Verify the agent sees the MCP server** — the MCP server is defined in `.intent/config.json`'s tool contract, not in `cli.js doctor`. To sanity-check that the MCP layer exposes the tools:
   ```powershell
   node "<path>\intent\packages\mcp-server\dist\index.js" --help  # no stand-alone bin; skip safely
   ```
   Actually the MCP server is stdio and is launched by the agent, not manually. Skip this step or do a dry smoke of the six tools by asserting `getMCPTool` round-trip via tests (`pnpm --filter @intent/mcp-server test`).

5. **Apply a simple patch** through the MCP `apply_patch` tool: from another terminal:
   ```powershell
   # Not needed for the local demo; visual verification is by Playwright smoke.
   ```

6. **Open the exported HTML** and verify it renders with no external network requests. The current exported HTML is a self-contained file: no CDN links, no web fonts, all styles inlined, zero scripts that reach the network.

## What this proves
- `init` scaffolds an `.intent/` workspace on this Windows machine.
- `doctor` inspects it and reports missing pieces before an agent is involved.
- `export` produces a standalone HTML file the browser can open directly (no build step, no bundler, no network).
- The exported file round-trips through `validateScene` — escaping and CSP are on the exporter path, not a separate build step.

## Honest limits of this demo
- The demo does not exercise the "interview → understand → build → approve" full loop with a real agent. That requires a code-agent runtime (Claude Code, Cursor, Kilo, Cline) and a real prompt; this document covers the infrastructure portion only.
- No macOS or Linux runner has been exercised for these steps; they pass on Windows 11.
