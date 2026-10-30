import sys

path = r'H:\folderrr\docs\pr.md'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

out = []
in_section_12 = False
past_section_12 = False
past_section_15 = False

for i, l in enumerate(lines):
    # Detect section 12 start
    if l.strip().startswith('## 12. Conflicts'):
        in_section_12 = True
    # Detect section 13 start
    if l.strip().startswith('## 13. Open Questions'):
        past_section_12 = True
        in_section_12 = False
    # Detect section 15 end
    if 'This completes Phase 0 document writing' in l:
        past_section_15 = True
    
    # Skip duplicate PR7-PR10 rows after section 15
    if past_section_15 and (l.strip().startswith('| PR7 |') or l.strip().startswith('| PR8 |') or l.strip().startswith('| PR9 |') or l.strip().startswith('| PR10 |')):
        continue
    
    out.append(l)

# Now insert PR7-PR10 into section 12's table after PR6
final_out = []
in_section_12_table = False
pr6_found = False

for i, l in enumerate(out):
    # Detect start of PR table in section 12
    if l.strip().startswith('| ID | Conflict or amendment'):
        in_section_12_table = True
    
    # Detect PR6 row
    if in_section_12_table and l.strip().startswith('| PR6 |'):
        pr6_found = True
    
    # After PR6 row, insert PR7-PR10 before the table ends
    if pr6_found and l.strip().startswith('|---') and i > 0 and not out[i-1].strip().startswith('| PR6 |'):
        final_out.append(l)
        final_out.append('| PR7 | **Source of truth: report, PR text or handoff.** R-B39 report, the handoff (context 7.3) and the PR description repeat fields. Proposal: the R-B39 report is the source. The PR description is a condensed copy of it. The handoff links to the PR. If they disagree, the report wins and the PR is corrected | rules R-B39, context 7.3 | accept |\n')
        final_out.append('| PR8 | **Before S-0-02 there is no CI and no template.** Phase 0 documents and Step R PRs have no required checks. The user may commit Phase 0 documents directly, or review them with kind B and no CI | plan section 4, 3.1 | info |\n')
        final_out.append('| PR9 | **Language.** Chat follows the user\'s language (R-B40). PR text, commit messages, titles and branch names are English | rules R-B40 | info |\n')
        final_out.append('| PR10 | **Two new checks.** TC-DOC-12 (the template copy equals this doc\'s section 2) and TC-CIC-14 (PR body lint: required sections present, no blank field, test IDs exist). Each needs a bad fixture. TC-CIC-14 depends on what the CI provider exposes (verify at S-0-02) | test sections 6.10 and 7.5 | accept |\n')
        pr6_found = False
        continue
    
    # Detect end of table
    if in_section_12_table and l.strip() == '' and pr6_found:
        in_section_12_table = False
    
    final_out.append(l)

# Add the missing paragraphs after section 12 table
final_out2 = []
added_ruling_order = False

for i, l in enumerate(final_out):
    final_out2.append(l)
    
    # After PR10 row, add ruling order and memory text
    if not added_ruling_order and l.strip().startswith('| PR10 |'):
        if i+1 < len(final_out) and final_out[i+1].strip() == '':
            pass  # Will add after blank line
        elif i+1 < len(final_out) and final_out[i+1].strip().startswith('##'):
            final_out2.append('\n')
            final_out2.append("Ruling order that avoids rework: PR1 and PR3 together with loop L4 (all three decide what the agent may do with git), then the other items in one batch.\n")
            final_out2.append('\n')
            final_out2.append("Memory's Pending total after this document is computed from the register. The agent adds PR1 to PR10 and verifies the total (memory M5). By my count the earlier 99 becomes 109, but the agent must recompute it.\n")
            added_ruling_order = True

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(final_out2)

print("Done")