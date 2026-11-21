p = r"H:\intent communication\RC.md"
addition = "\n\n## Known limits — 2026-11-21 (Phase 1 RC, v0.1.0-rc.1)\n\n"
addition += "- **HUMAN GATE 1 not yet performed.** tests/smoke/CHECKLIST.md is deliberately unfilled; no live /intent -> /prototype session has been run; no agent version/OS recorded. The owner must run it before claiming the gate.\n"
addition += "- **97% acceptance is an unmeasured target**, not a measured result. The agent-driven trial (tests/trial/) reports measured numbers with denominators and is labelled \"agent-driven, simulated personas — does NOT prove human intent match.\"\n"
addition += "- **Adapters other than Claude Code, Cursor, Gemini CLI and VS Code MCP are UNVERIFIED** (config paths/formats not confirmed against live docs); they ship manual snippets instead of guessed edits.\n"
addition += "- **Single-file bundle is ~4.7 MB** (minified). Acceptable for a local tarball; revisit before npm publish.\n"
addition += "- **No npm publish was performed** (agent forbidden). Owner runs npm login + npm publish --access public.\n"
addition += "- **macOS/Linux fidelity calibration is Windows-only evidence** (CI green on 3 OSes for build/test, but no fidelity re-measurement on mac/linux).\n"
addition += "- **Tier-2 live agent session does not exist**; second agent for Gate 1 is a scripted persona (labelled).\n"
addition += "- **Animations, profile learning, scanner, acceptance-rate views, ReactExporter with Design Profile** are implemented per plan.md progress notes but have not been re-verified in this phase beyond the existing test suite.\n"
open(p, "a").write(addition)
print("done")
