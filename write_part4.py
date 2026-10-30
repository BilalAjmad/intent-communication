# Part 4: Sections 12-15

part4 = """## 12. Conflicts, Amendments and Flags

Nothing in earlier documents has been changed silently. Each item needs the user's ruling, then a dated change-log entry in the affected document.

| ID | Conflict or amendment | Affects | Rec |
|----|----------------------|---------|-----|
| PR1 | **Merge method.** Squash-merge collapses commits, so the per-commit green state, the `Step:` and `Ruling:` trailers and the "test and code together" pairing are lost on the base branch, and TC-CIC-07 and TC-CIC-13 cannot see them. Recommended: merge commit or rebase-merge, squash only for docs-only PRs (7.4). The alternative is squash everywhere with trailers copied into the squash message, which weakens the checks | rules R-B34, test TC-CIC-07, review V3 | **decide** |
| PR2 | **Template location depends on the CI provider.** The provider is assumed to be GitHub and is unverified (plan P5, PQ3). The canonical template lives in this doc (section 2) and is copied to the provider's location at S-0-02. TC-DOC-12 keeps them equal | plan S-0-02, test | accept |
| PR3 | **PR creation is separate from pushing.** R-B33 forbids opening a PR unless asked. Loop L4 option B proposes a standing permission to push `work/*` branches. State that this permission does **not** cover creating or updating a PR, merging or tagging. Creating a PR needs the user's request or the user's own authorized CLI session. The agent holds no credentials | rules R-B33, loop L4, plan PL-10 | accept |
| PR4 | **Size limits are starting values.** About 400 hand-written changed lines, one step, one Phase 0 doc. Tuned after M1 (PRQ1) | review RP-06, plan PL-01 | accept |
| PR5 | **Trailer set and step IDs.** loop 4.3 requires `Step: S-x-yy`. Phase 0 documents and Step R have no S-x-yy IDs in plan.md (`S-R-nn` exists, Phase 0 docs do not). Define `P0-<nn>` for documents. Add the `Waiver: WV-n` trailer (section 5.3). Extend TC-CIC-07 to require `Step:` | loop 4.3, plan section 4, test TC-CIC-07 | accept |
| PR6 | **T-PR pack and "short by design".** context 3 says pr.md is loaded whole and context 5.3 lists T-PR as "pr.md, R-B33, R-B34, R-B39". Proposal: T-PR loads pr.md sections 2 to 5 and 9, plus the section for the PR kind (8). Update context 3 and 5.3 | context 3, 5.3 | accept |
| PR7 | **Source of truth: report, PR text or handoff.** R-B39 report, the handoff (context 7.3) and the PR description repeat fields. Proposal: the R-B39 report is the source. The PR description is a condensed copy of it. The handoff links to the PR. If they disagree, the report wins and the PR is corrected | rules R-B39, context 7.3 | accept |
| PR8 | **Before S-0-02 there is no CI and no template.** Phase 0 documents and Step R PRs have no required checks. The user may commit Phase 0 documents directly, or review them with kind B and no CI | plan section 4, 3.1 | info |
| PR9 | **Language.** Chat follows the user's language (R-B40). PR text, commit messages, titles and branch names are English | rules R-B40 | info |
| PR10 | **Two new checks.** TC-DOC-12 (the template copy equals this doc's section 2) and TC-CIC-14 (PR body lint: required sections present, no blank field, test IDs exist). Each needs a bad fixture. TC-CIC-14 depends on what the CI provider exposes (verify at S-0-02) | test sections 6.10 and 7.5 | accept |

Ruling order that avoids rework: PR1 and PR3 together with loop L4 (all three decide what the agent may do with git), then the other items in one batch.

Memory's Pending total after this document is computed from the register. The agent adds PR1 to PR10 and verifies the total (memory M5). By my count the earlier 99 becomes 109, but the agent must recompute it.

## 13. Open Questions

- PRQ1. Tune the size limit and the required-section list after the M1 actuals.
- PRQ2. Does the CI provider expose the PR body to checks, so TC-CIC-14 can run? Verify at S-0-02.
- PRQ3. Who opens PRs: the user by hand, or the agent through the user's authorized CLI session? User decision with PR3.
- PRQ4. Is a single `PULL_REQUEST_TEMPLATE` enough, or are per-kind templates worth the maintenance (the section 3 table suggests one template with N/A fields)? Default: one template.
- PRQ5. Should review reports in `docs/reviews/` be linked from the PR by path or pasted in? Default: linked (review 14.3).

## 14. Flags for Later Documents and Steps

- **memory.md:** register PR1 to PR10 (all Pending). The Document Registry (section 2) needs rows 8 to 13 updated now that all 13 documents exist. This is a registry update, not an amendment status.
- **plan.md:** S-0-02 copies the template to the provider's location and sets up TC-DOC-12 and TC-CIC-14, and defines branch protection settings for the user to apply. Add `P0-nn` step IDs (PR5).
- **context.md:** the T-PR pack (PR6).
- **test.md:** TC-DOC-12, TC-CIC-14 and the `Step:` extension of TC-CIC-07, each with a bad fixture.
- **loop.md:** phase 9 report includes the PR text. Handoff links to the PR.
- **rules.md:** R-B33 states that a standing push permission is not PR creation (PR3). R-B39 names the report as the source of the PR text (PR7).
- **review.md:** RV-04 and the gate checklist read the PR fields in section 2.

## 15. Change Log

- 2026-10-29: v0.1 created from prd.md, design.md, architecture.md, trd.md, rules.md, context.md, memory.md, intent.md, plan.md, test.md, loop.md and review.md v0.1. Proposes PR1 to PR10. Resolves the PR-related flags of rules, context, memory, intent, plan, test, loop and review. This completes Phase 0 document writing (13 of 13).
"""

with open(r'H:\folderrr\docs\pr.md', 'a', encoding='utf-8') as f:
    f.write('\n\n' + part4)

print("Part 4 written:", len(part4))