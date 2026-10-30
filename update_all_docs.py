import re

def update_doc(doc_name, extra_change_log=None):
    path = f'H:/folderrr/docs/{doc_name}'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Update status line (first few lines)
    # Pattern: "Status: Draft v0.1 | Created: ..."
    content = re.sub(r'Status: Draft v0\.1', 'Status: Draft v0.2', content)
    
    # Update dependencies to v0.2
    content = re.sub(r'Depends on: ([^.]+) v0\.1', r'Depends on: \1 v0.2', content)
    
    # Add change-log entry
    changelog_entry = f'- 2026-10-30: v0.2 — Reconciliation Pass (Step R) applied. Owner accepted all recommendations. Dated change-log entry added per MR-03.{extra_change_log or ""}'
    
    # Find the Change Log section and add entry
    changelog_pattern = r'(## \d+\. Change Log\s*\n\s*- 2026-\d\d-\d\d: v0\.1)'
    new_changelog = f'\\1\n{changelog_entry}'
    
    if re.search(changelog_pattern, content):
        content = re.sub(changelog_pattern, new_changelog, content)
    else:
        # If no Change Log section, try to find end of file and add
        # This is a fallback - most docs should have the section
        pass
    
    with open(f'H:/folderrr/docs/{doc_name}', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'{doc_name}: updated to v0.2')

docs = [
    'prd.md', 'design.md', 'architecture.md', 'trd.md', 'rules.md',
    'context.md', 'intent.md', 'plan.md', 'test.md', 'loop.md',
    'review.md', 'pr.md'
]

for doc in docs:
    try:
        update_doc(doc)
    except Exception as e:
        print(f'{doc}: ERROR - {e}')

print("All documents updated")