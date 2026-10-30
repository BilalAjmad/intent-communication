import re

with open('H:/folderrr/docs/memory.md', 'r', encoding='utf-8') as f:
    content = f.read()

# 6. Update Open Questions Register with resolved items
oq_updates = {
    'OQ1': '| OQ1 | Final product and npm package name | memory.md (VF-010), then user | Resolved: `intent-studio` available |',
    'OQ2': '| OQ2 | Minimum Node version | trd 2.1 and 2.3 | Resolved: Node.js 22 LTS (v22.22+) per VF-001 |',
    'OQ4': '| OQ4 | Schema versioning | trd 19 | Resolved by C8 (Applied) |',
    'DQ1': '| DQ1 | Annotation PNG default | architecture C7, trd 9.7 | Resolved by C7 (Applied) |',
    'DQ4': '| DQ4 | States static HTML cannot express | trd 13.6 | Resolved |',
    'AQ2': '| AQ2 | Lock timeout and retry | trd 9.2 | Resolved (needs per-OS tests) |',
    'AQ3': '| AQ3 | How `open_studio` hands the URL to agents that cannot open a browser | README, rules R-R30 | Resolved in trd 10.8 |',
    'AQ5': '| AQ5 | Maximum scene size | trd 15 and 20 | Resolved |',
    'RQ1': '| RQ1 | Trigger line for agents without rule loading | context.md 8.4 | Resolved (final wording per agent in M1 step 0) |',
}

for oq_id, oq_row in oq_updates.items():
    pattern = rf'\| {oq_id} \| [^|]+ \| [^|]+ \| [^|]+ \|'
    content = re.sub(pattern, oq_row, content)

# 7. Update Change Log for v0.2
changelog_pattern = r'(## 16\. Change Log.*?- 2026-10-26: v0\.1 created from prd\.md, design\.md, architecture\.md, trd\.md, rules\.md, context\.md v0\.1\. Seeds H-0001, MD-001 to MD-007, LS-001 to LS-008, the Amendment Register \(35 items\), the Verified Facts table \(12 rows, all UNVERIFIED\) and the Open Questions register\. Introduces M1 to M5 for review\.)'
new_changelog = r'''\1
- 2026-10-30: v0.2 — Reconciliation Pass (Step R) completed. Owner waived one-by-one rulings (WV-001). All 109 Pending amendments marked Applied. 13 decisions added (MD-008 to MD-020). Waiver WV-001 recorded. 12 Verified Facts populated (VF-001 to VF-012). docs/versions.md created. All 13 Phase 0 documents raised to v0.2 with dated change-log entries. Document Registry updated: rows 8-13 now "Written" v0.2. All amendment statuses: Pending -> Applied. Open Questions updated with 9 resolved items. This completes Phase 0 and Step R. Ready for S-0-01.'''

content = re.sub(changelog_pattern, new_changelog, content, flags=re.DOTALL)

with open('H:/folderrr/docs/memory.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("Open Questions and Change Log updated")