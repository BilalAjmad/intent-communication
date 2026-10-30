import re

with open('H:/folderrr/docs/memory.md', 'r', encoding='utf-8') as f:
    content = f.read()

# 2. Add new Decision Log entries (MD-008 to MD-021)
decision_log_pattern = r'(## 5\. Decision Log.*?\| MD-007 \| 2026-10-22 \| \*\*Working name\*\* is \"Intent\", package `intent-studio`\. Not yet checked for availability \| PRD OQ1, trd 2\.3 \| Master Prompt \| Accepted as working name only \|\n)'
new_decisions = r'''\1
| MD-008 | 2026-10-30 | **C-R1: Interview scope.** Interview for design, UI and vague build requests. Skip for precise/small tasks. I9 modes accepted | intent.md, rules.md | Owner ruling | Applied |
| MD-009 | 2026-10-30 | **C2: Keep six MCP tools.** `ask_user` stays one tool, six tools stay six (PRD FR-S1) | trd.md, intent.md | Owner ruling | Applied |
| MD-010 | 2026-10-30 | **T5 + I2: Meter computed by server.** Server derives applied percent from slot evidence; agent percent is advisory; `reopen` added | intent.md, trd.md | Owner ruling | Applied |
| MD-011 | 2026-10-30 | **C-R2 + I3: Core derives profile.** `core` derives profile from `signals.json` with promotion rules; agent never writes profile.json (R-R36 stays) | architecture.md, trd.md, intent.md | Owner ruling | Applied |
| MD-012 | 2026-10-30 | **I1: Question bank in core.** Bank lives in `core`, served by `ask_user` with `kind: "start"` returning `next` seeds | intent.md, trd.md | Owner ruling | Applied |
| MD-013 | 2026-10-30 | **I7: brief.json committed.** `.intent/brief.json` committed; README warns to review before first run | intent.md, architecture.md | Owner ruling | Applied |
| MD-014 | 2026-10-30 | **P1: Refine mode and metrics.json to M2.** `metrics.json` and Refine mode moved from M1 to M2 | plan.md | Owner ruling | Applied |
| MD-015 | 2026-10-30 | **P8 + TS2: Human trial deferred to M3.** Report measured numbers only; 97% is labeled target, not validation | plan.md, test.md | Owner ruling | Applied |
| MD-016 | 2026-10-30 | **TS1: Two match numbers.** Initial match and final match; until M3 the 97% is only a labeled target | test.md | Owner ruling | Applied |
| MD-017 | 2026-10-30 | **TS9: Tier 1 definition.** Scripted MCP tests on every push + manual smoke checklist per release | test.md | Owner ruling | Applied |
| MD-018 | 2026-10-30 | **L4 option A: User pushes.** Agent never pushes; status stays "Done (local)" until CI evidence | loop.md, plan.md | Owner ruling | Applied |
| MD-019 | 2026-10-30 | **V1 option A: Independent fresh-session review.** L2 required for high-risk changes and gates | review.md | Owner ruling | Applied |
| MD-020 | 2026-10-30 | **PR1: Merge commit or rebase-merge.** Squash only for docs-only PRs. PR3: Agent never opens PRs | pr.md, loop.md, plan.md | Owner ruling | Applied |
| MD-021 | 2026-10-30 | **WV-001: Waiver for Step R.** One-by-one rulings waived; owner accepted planning assistant recommendations for all 109 items | memory.md | Owner ruling | Applied |

'''

content = re.sub(decision_log_pattern, new_decisions, content, flags=re.DOTALL)

with open('H:/folderrr/docs/memory.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("Decisions updated")