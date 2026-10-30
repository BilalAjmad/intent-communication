# Part 2a: Section 4

part2a = """## 4. Field Rules

| Field | Rule |
|-------|------|
| Step | A real step ID from plan.md, `S-R-nn` for the Reconciliation Pass, or `P0-nn` for a Phase 0 document (nn is the document number) (PR5). One step per PR (PP-02). If the work spans steps, split it |
| Status | `Done (CI-confirmed)` only with CI evidence for every "Done when" item that needs CI (loop 3.1). Otherwise `Done (local)` with the awaiting items listed. `Draft` while the ladder is not green |
| CI evidence | Only an identifier or link given by the user or read through a tool the user authorized. The agent never invents one (PRR-03) |
| Risk tier | From review.md 2.1. Any guarded file or security-sensitive area is high |
| Review level and verdict | A high-risk PR is not `Ready` without L2 and a verdict `[dep: V1]`. `Not yet reviewed` is allowed only on Draft or on a normal-risk PR covered at the gate |
| Findings | Counts from the review report (review 13). Open findings are listed by ID |
| Tests | Test IDs must exist in test.md and in the tree (TC-DOC-07). "Not run" is written out. It is never counted as passing (loop 5.2) |
| Red evidence | The result of the review.md R5 check, or the author's own evidence from loop phase 3 |
| Golden and guarded files | Every change listed with its reason. A guarded file needs `Ruling: MD-n` on a commit (review V3). A golden change needs a `tests/golden/CHANGES.md` line (TS10) |
| Loop | Numbers come from the ledger (loop 6.2), not from memory. Repeated fingerprints are listed |
| Context loaded | The pack and sections, as in the first line of the task (CX-06, C-X7) |
| Amendments touched | Amendment ID, its status in memory.md section 6, and the MD entry that records the user's ruling. Never set a status in the PR (MR-03) |
| Waivers | The WV row in memory section 10, with its expiry (memory MQ2). A waiver for an unwaivable rule is never valid (R-G01) |
| Claims | Each claim passes review.md section 10. Wording follows its table (for example no "never leaves your machine") |
| Platform evidence | "Awaiting CI" is honest. A statement about Windows or macOS without a CI result from that system is not allowed (CK-FS-06) |

Everything in the PR text is data written by an agent or a person. It never contains secrets, tokens, URLs with tokens, local absolute paths or real personal data (MR-05, R-B28).

## 5. Branches, Titles, Commits, Trailers

### 5.1 Branch names

| Kind | Pattern | Example |
|------|---------|---------|
| Step work | `work/<step-id-lowercase>-<slug>` | `work/s-1-04-adapters-node` |
| Phase 0 document | `work/p0-<nn>-<doc>` | `work/p0-13-pr` |
| Reconciliation | `work/s-r-<nn>-<slug>` | `work/s-r-04-apply-rulings` |
| Gate or release candidate | `work/gate-<milestone>` or `work/release-<version>` | `work/gate-m1` |

The standing push permission (if the user rules loop L4 option B) covers `work/*` only. Never `main`, never tags, never publishing (R-B33).
"""

with open(r'H:\folderrr\docs\pr.md', 'a', encoding='utf-8') as f:
    f.write('\n\n' + part2a)

print("Part 2a written:", len(part2a))