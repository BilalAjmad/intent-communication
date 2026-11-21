p = r"H:\intent communication\tests\smoke\CHECKLIST.md"
s = open(p, encoding="utf-8").read()
s = s.replace("**Executed**: 2026-11-21 - scripted persona (no live agent); AgentSeeAI available (doctor passes) but live Claude Code IDE session could not be driven in this automated context",
              "**Executed**: 2026-11-21 - LIVE session via Kilo Code 7.8.31 (headless, kilo run) + scripted persona driver (secondary)")
s = s.replace("**Agent name and exact version**: scripted persona driver (Node MCP client) speaking to the real server; Claude Code 2.1.304 installed",
              "**Agent name and exact version**: Kilo Code 7.8.31 (primary, live) + scripted persona driver (secondary)")
open(p, "w", encoding="utf-8").write(s)
print("done")
