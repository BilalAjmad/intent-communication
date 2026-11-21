p = r"H:\intent communication\docs\versions.md"
s = open(p).read()
add = "\n\n## Claude Code headless mode — fetched 2026-11-21\n\n"
add += "- URL: https://code.claude.com/docs/en/headless\n"
add += "- Result: VERIFIED 2026-11-21. `claude -p` runs non-interactively; slash commands work when included in the prompt string; `--continue` / `--resume <session_id>` continue a conversation; `--allowedTools` auto-approves tools; `--output-format json` returns session_id. MCP servers from `.mcp.json` connect in `-p` mode.\n"
add += "- Limitation observed: this machine's Claude Code is configured against OpenRouter (z-ai/glm-5.3-flash) with 0 credits, so no live session could be driven. Fallback used: scripted persona driver speaking MCP to the real server (labelled \"scripted persona (no live agent)\").\n"
add += "- Second agent: only Claude Code, Kilo, Gemini, Cline, OpenCode CLIs are installed; Cursor `agent` is NOT installed. Kilo Code used as the second agent via its MCP config (config-only verification, no live session possible without credits).\n"
s = s.rstrip() + "\n" + add
open(p, "w").write(s)
print("done")
