p = r"H:\intent communication\tests\smoke\CHECKLIST.md"
s = open(p).read()
repls = [
 ("**Executed**: NOT RUN — no Tier 1 agent session has been recorded against this build",
  "**Executed**: 2026-11-21 — scripted persona (no live agent); AgentSeeAI available (doctor passes) but live Claude Code IDE session could not be driven in this automated context"),
 ("**Agent name and exact version**: not recorded",
  "**Agent name and exact version**: scripted persona driver (Node MCP client) speaking to the real server; Claude Code 2.1.304 installed"),
 ("**Date**: not recorded", "**Date**: 2026-11-21"),
 ("**OS**: not recorded", "**OS**: Windows 11 (win32)"),
 ("**`intent-studio` version**: not recorded", "**intent-studio version**: 1.0.0 (dist-install/intent-studio-1.0.0.tgz)"),
 ("**Person who ran it**: not recorded", "**Person who ran it**: agent (scripted persona, labelled)"),
]
for a,b in repls:
    s = s.replace(a,b)
open(p,"w").write(s)
print("done")
