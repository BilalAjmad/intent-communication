with open(r'H:\intent communication\docs\memory.md', 'r', encoding='utf-8') as f:
    content = f.read()

old = """| MD-007 | 2026-10-22 | **Working name** is "Intent", package "intent-studio". Not yet checked for availability | PRD OQ1, trd 2.3 | Master Prompt | Accepted as working name only |
121: 
122: Decisions made later by the build agent are added here with a source and a status. A decision that changes a doc needs the doc's change-log entry first (R-B38)."""

new = """| MD-007 | 2026-10-22 | **Working name** is "Intent", package "intent-studio". Not yet checked for availability | PRD OQ1, trd 2.3 | Master Prompt | Accepted as working name only |
121: 
122: | MD-008 | 2026-11-02 | **C-R1 + I9: Interview scope.** Interview only for design, UI and vague build requests; not for typos, bug fixes or precise tasks. User can skip. | PRD FR-A1, rules R-R01 | User accepted Round 1, Decision 1 (Option 1) | Accepted |
123: | MD-009 | 2026-11-02 | **C-R2 + I3: Profile derivation.** core derives .intent/profile.json from signals; agent never writes it. | trd 17.1, rules R-R36 | User accepted Round 1, Decision 2 (Option 1) | Accepted |
124: | MD-010 | 2026-11-02 | **T5 + I2: Meter from evidence.** Server computes serverPercent from slot evidence; applied = min(agent, server); cap 89 while required topic uncovered. Extends T5. | PRD FR-A4, trd 10.2 | User accepted Round 1, Decision 3 (Option 1) | Accepted |
124: | MD-011 | 2026-11-02 | **I1: ask_user kind: "start"**. Add kind: "start" with taskSummary, taskSize?, harvested?. resumed: true on subsequent calls. | trd 10.2, 10.7, intent 4.2 | User accepted Round 1, Decision 4 (Option 1) | Accepted |
124: | MD-012 | 2026-11-02 | **I7: brief.json committed on approval.** interview-approved version saved; first-run metric baseline is first-render version at first apply_patch to "scene". | trd 10.2 rule 5, 17.2, architecture 6 | User accepted Round 1, Decision 5 (Option 1) | Accepted |
126: 
127: Decisions made later by the build agent are added here with a source and a status. A decision that changes a doc needs the doc's change-log entry first (R-B38)."""

with open(r'H:\intent communication\docs\memory.md', 'r', encoding='utf-8') as f:
    content = f.read()

old = """| MD-007 | 2026-10-22 | **Working name** is "Intent", package "intent-studio". Not yet checked for availability | PRD OQ1, trd 2.3 | Master Prompt | Accepted as working name only |
121: 
122: Decisions made later by the build agent are added here with a source and a status. A decision that changes a doc needs the doc's change-log entry first (R-B38)."""

new = """| MD-007 | 2026-10-22 | **Working name** is "Intent", package "intent-studio". Not yet checked for availability | PRD OQ1, trd 2.3 | Master Prompt | Accepted as working name only |
121: 
122: | MD-008 | 2026-11-02 | **C-R1 + I9: Interview scope.** Interview only for design, UI and vague build requests; not for typos, bug fixes or precise tasks. User can skip. | PRD FR-A1, rules R-R01 | User accepted Round 1, Decision 1 (Option 1) | Accepted |
123: | MD-009 | 2026-11-02 | **C-R2 + I3: Profile derivation.** core derives .intent/profile.json from signals; agent never writes it. | trd 17.1, rules R-R36 | User accepted Round 1, Decision 2 (Option 1) | Accepted |
124: | MD-010 | 2026-11-02 | **T5 + I2: Meter from evidence.** Server computes serverPercent from slot evidence; applied = min(agent, server); cap 89 while required topic uncovered. Extends T5. | PRD FR-A4, trd 10.2 | User accepted Round 1, Decision 3 (Option 1) | Accepted |
124: | MD-011 | 2026-11-02 | **I1: ask_user kind: "start"**. Add kind: "start" with taskSummary, taskSize?, harvested?. resumed: true on subsequent calls. | trd 10.2, 10.7, intent 4.2 | User accepted Round 1, Decision 4 (Option 1) | Accepted |
124: | MD-012 | 2026-11-02 | **I7: brief.json committed on approval.** interview-approved version saved; first-run metric baseline is first-render version at first apply_patch to "scene". | trd 10.2 rule 5, 17.2, architecture 6 | User accepted Round 1, Decision 5 (Option 1) | Accepted |
126: 
127: Decisions made later by the build agent are added here with a source and a status. A decision that changes a doc needs the doc's change-log entry first (R-B38)."""

if old in content:
    content = content.replace(old, new)
    with open(r'H:\intent communication\docs\memory.md', 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS')
else:
    print('OLD TEXT NOT FOUND')
    idx = content.find('| MD-007 | 2026-10-22')
    if idx >= 0:
        print('Found at index:', idx)
        print('Context:', repr(content[max(0,idx-50):idx+200]))
    else:
        print('NOT FOUND')