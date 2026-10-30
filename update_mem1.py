import re

with open('H:/folderrr/docs/memory.md', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Handoff section
handoff_pattern = r'(### H-0001 2026-10-26 Phase 0: documents 1 to 7.*?Files to look at first: docs/rules\.md section 20, docs/context\.md section 15 and 16, docs/trd\.md sections 10\.2 and 17\.1\n)'
new_handoff = r'''\1

### H-0002 2026-10-30 Phase 0 Complete: Reconciliation Pass (Step R)
Pack used: T-DOC
Done:
- All 13 Phase 0 documents written and approved (v0.2)
- Waiver WV-001 granted for Step R (one-by-one rulings waived)
- All 109 Pending amendments marked Applied (owner accepted recommendations)
- 15 Decisions recorded (MD-001 to MD-021)
- 12 Verified Facts populated (VF-001 to VF-012)
- docs/versions.md created from official sources
Evidence: User ruling message 2026-10-30; docs/versions.md; all docs raised to v0.2
Not done / blocked:
- M1 milestone not yet started
Decisions:
- C-R1: Interview only for design/UI/vague requests; I9 modes accepted
- C2: Keep six MCP tools
- T5+I2: Meter computed by server from slot evidence
- C-R2+I3: Core derives profile; agent never writes it
- I1: Question bank lives in core, served by ask_user (kind "start")
- I7: brief.json committed; README warns to review it first
- P1: Refine mode and metrics.json moved to M2
- P8+TS2: Human trial deferred to M3; report measured numbers only
- TS1: Two numbers (initial match, final match); 97% is labeled target until M3
- TS9: Tier 1 = scripted MCP tests on every push + manual smoke checklist per release
- L4 option A: User pushes; agent never pushes; status stays "Done (local)" until CI evidence
- V1 option A: Independent fresh-session review for high-risk changes and gates
- PR1: Merge commit or rebase-merge; squash only for docs-only PRs. PR3 accepted
Verified facts: VF-001 to VF-012 populated from official sources
Docs needing a change-log entry: all 13 docs (v0.1 -> v0.2 with change-log entries)
Next step: S-0-01 verification (docs/versions.md), then S-0-02 toolchain and bootstrap
Files to look at first: docs/versions.md, docs/plan.md sections 5 and 6

### H-0003 2026-10-30 S-0-01 Verification Log Complete
Pack used: T-VERIFY
Done:
- docs/versions.md verified against official sources
- All 15 items recorded with version, date, source URL
- 15 UNVERIFIED items noted (Playwright, Codex/Windsurf/Copilot config, pixel-diff clusters, PR body access, Tier 1 CI)
Evidence: docs/versions.md with 16 sections
Not done / blocked:
- UNVERIFIED items must be resolved before pinning dependencies
Decisions: None new
Verified facts: VF-001 to VF-012 now populated
Docs needing a change-log entry: none (memory.md already updated)
Next step: S-0-02 toolchain and bootstrap (docs/plan.md section 5)
Files to look at first: docs/plan.md section 5, docs/trd.md sections 10.2 and 17.1, docs/rules.md R-B07/R-B29, docs/architecture.md section 15, docs/memory.md section 7
'''

content = re.sub(handoff_pattern, new_handoff, content, flags=re.DOTALL)

with open('H:/folderrr/docs/memory.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("Handoffs updated")