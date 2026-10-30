# Part 2b: Sections 5.2, 5.3, 6, 7

part2b = """### 5.2 PR title

`<type>(<scope>): <subject> [<step id>]`. Type is a conventional-commit type. Scope is a package name, `docs`, `ci` or `release`. The subject is imperative and at most 72 characters. Example: `feat(core): add the write pipeline [S-1-05]`.

### 5.3 Commit rules

1. Conventional commits, one concern, green at every commit, no `--no-verify` (R-B34, loop 4.3).
2. A failing test and the code that makes it pass travel in one commit (loop L2).
3. **Trailers** on every commit body:

| Trailer | When | Meaning |
|---------|------|---------|
| `Step: <id>` | Always | The plan step (loop 4.3) |
| `Ruling: MD-<n>` | Any change to a guarded file (review V3, TC-CIC-13) | The recorded user decision that allows it |
| `Waiver: WV-<n>` | A rule was waived for this change (R-G01) | The waiver record |

4. No history rewrite once review has started. After that, fix with new commits. Before review, a rebase of one's own `work/*` branch is allowed. No force-push to any shared branch (R-B34).
5. Keep the branch current with the base by merging the base into it, not by rebasing, once review has started.

## 6. Size and Splitting

| Limit | Starting value | Notes |
|-------|----------------|-------|
| Steps per PR | 1 | PP-02 |
| Hand-written changed lines (source and tests) | about 400 | Excludes lockfiles, generated files, goldens and fixtures. A starting guess, tuned from M1 actuals (PRQ1) |
| Phase 0 docs per PR | 1 | Matches R-B02 |
| Reviewable in one session | Required | If a reviewer cannot finish, the verdict is `Blocked` and the author splits (RP-06) |

Splitting order when a PR is too large: (1) the dependency commit, (2) pure refactors, (3) tests plus the smallest implementation that passes them, (4) the rest. Each part is green on its own.

## 7. Lifecycle and Merge Gates

### 7.1 States

`Draft` (ladder not green or template incomplete) then `Ready` then `Changes requested` or `Approved (recommended)` then `Merged` (by the user). The agent moves a PR between Draft and Ready only. It never merges, approves its own PR, deletes branches or changes repository settings (PRR-10).

### 7.2 Ready gate (author)

1. The ladder rungs for the change are green locally (loop 5), the template is complete, and the status is honest.
2. SR-01 to SR-11 are done (loop 12).
3. Review is requested at the right level: L2 for high-risk PRs `[dep: V1]`.
4. Docs, memory and the handoff are updated (R-B37).

### 7.3 Merge gate (user decides)

| # | Condition |
|---|-----------|
| 1 | All required CI checks are green on the PR head, on every operating system in the matrix once CI exists (plan P5). A red or skipped required check blocks the merge. No bypass |
| 2 | The review verdict is Approve or Approve with notes, or the user waives in writing (R-G01). No open Blocker, no open Major without a waiver |
| 3 | Findings are closed per review 13.4. Disputes are decided by the user and recorded as an MD entry |
| 4 | Every claimed `Done (CI-confirmed)` item has CI evidence in the PR |
| 5 | The branch is current with the base |
| 6 | For a docs or rulings PR: the DR or AR checklist passed (review 6) |

### 7.4 Merge method (PR1)

Recommended: **merge commit or rebase-merge**, so each green commit and its trailers stay in history and TC-CIC-07 and TC-CIC-13 keep working on the base branch. Squash only for docs-only PRs, with the PR title as the subject and the trailers copied into the squash message. The user chooses (PR1).

### 7.5 After the merge (agent, when told it happened)

Update plan.md's current-step block and the status (`Done (CI-confirmed)` only with evidence), memory.md, and the handoff (loop phase 9). Defects found later get a lesson (review 15).
"""

with open(r'H:\folderrr\docs\pr.md', 'a', encoding='utf-8') as f:
    f.write('\n\n' + part2b)

print("Part 2b written:", len(part2b))