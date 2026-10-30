# Write pr.md in parts to avoid escaping issues

# Part 1: Sections 1-3
part1 = """# pr.md: Intent Pull Request and Merge Specification

Status: Draft v0.1 | Created: 2026-10-29 | Depends on: prd.md, design.md, architecture.md, trd.md, rules.md, context.md, memory.md, intent.md, plan.md, test.md, loop.md, review.md (all v0.1)

This document defines how a finished task becomes a pull request, what the PR must contain, which gates it passes before the user merges it, and what the agent may and may not do with branches, pushes and PRs. It applies to **building this repository** only. The shipped product never creates PRs.

Section numbers are stable anchors (context.md CX-08). New content is appended, never renumbered. For pack T-PR (context 5.3), load sections 2 to 5 and 9, plus the section for the PR kind (8).

---

## 1. Purpose and Principles

| ID | Principle |
|----|-----------|
| PP-01 | **A PR is a claim with evidence.** Every statement in it points to something run in this session or to a doc section (R-B08, RP-02) |
| PP-02 | **One step, one concern.** A PR serves one plan step (PL-01) and is small enough to review in one session (RP-06) |
| PP-03 | **The template has no empty fields.** Write `None` or `N/A (reason)`. A blank field reads as "forgotten" |
| PP-04 | **Honest status.** A PR says `Done (local)` until CI evidence exists (loop 3.1). It never says `CI-confirmed` without it |
| PP-05 | **The user decides.** Opening, merging, tagging and publishing belong to the user (R-B33, PL-10). The agent prepares |
| PP-06 | **History stays reviewable.** Commits are green, conventional and carry trailers. No history rewrite once review has started |
| PP-07 | **Nothing hidden.** Guarded-file changes, golden changes, waivers, amendments, claims and security-sensitive areas are listed, never buried in the diff |
| PP-08 | **Cheap to read.** The first screen of a PR answers: what, which step, how risky, how tested, what is not done |

## 2. The PR Template

This is the canonical template (PR2). It is copied unchanged to the CI provider's PR-template location at S-0-02, and a parity test keeps the copy equal to this section (TC-DOC-12). The text is English even when the chat is not (R-B40).

```
## Summary
<One to three sentences: what changed and why.>

## Step and acceptance
- Step: <S-x-yy | S-R-nn | P0-nn> <title>      Size: <S|M>      Pack: <T-...>
- Kind: <code | docs | rulings | bank | dependency | ci | gate | release | revert>
- Acceptance criteria served: <AC-... | N/A (reason)>
- Status: <Draft | Done (local) | Done (CI-confirmed)>
- CI evidence: <run identifier or link as given by the user | awaiting CI>
- Not done / out of scope: <list or None>

## Risk and review
- Risk tier: <high | normal>   Areas: <packages or files>
- Review level: <L1 | L2>   Reviewer: <agent and version | person | none>   Verdict: <Approve | Approve with notes | Changes requested | Blocked | Not yet reviewed>
- Findings: Blocker <n>  Major <n>  Minor <n>  Note <n>   Open: <F-ids or None>
- Security-sensitive area (review kind F): <yes, done | yes, not done | no>
- Review report: <chat | docs/reviews/<file> | none>

## Tests
- Test IDs added or changed: <TC-... or None>
- Layers run locally: <L0 L1 ...>   Not run: <list or None>
- Red evidence: <n of n new tests failed on the parent commit | N/A (reason)>
- Golden files changed: <file, reason, CHANGES.md line | None>
- Guarded files changed: <file, Ruling: MD-n | None>

## Loop
- Attempts: <n>   Reruns: <n>   Stops: <None | ST-xx and stop-report reference>
- Repeated fingerprints: <None | short list>
- Context loaded: <pack and sections>   Not loaded: <notable omissions>

## Docs, amendments, waivers, memory
- Docs changed (each with a change-log entry): <list or None>
- Amendments touched: <ID, status, Ruling: MD-n | None>
- Waivers used: <WV-n | None>
- Memory updated: <MD-/VF-/LS- ids | None>   Handoff written: <yes | no (reason)>

## Kind-specific
- Seeds changed: <seed ids and intent.md section | N/A>
- Dependencies: <name, exact version, docs/versions.md row, licence | N/A>
- Claims touched: <README, CLI text, Studio strings, errors, with evidence | None>
- Platform evidence: <OS and CI result for each | awaiting CI | N/A>

## Author checklist
- [ ] SR-01 to SR-11 done by me (loop.md 12)
- [ ] The template has no blank field
- [ ] Every test ID, section number and rule ID named here exists
- [ ] No secret, token, URL with a token, local path or real personal data
- [ ] Every statement above matches evidence from this session
```

## 3. Required Sections by PR Kind

`R` = required. `A` = required if the area applies. `-` = write `N/A`.

| Section | code | docs | rulings | bank | dependency | ci | gate | release | revert |
|---------|------|------|---------|------|------------|----|------|---------|--------|
| Summary, Step and acceptance | R | R | R | R | R | R | R | R | R |
| Risk and review | R | R | R | R | R | R | R | R | R |
| Tests | R | - | A | R | R | R | R | R | R |
| Loop | R | R | R | R | R | R | R | R | R |
| Docs, amendments, waivers, memory | A | R | R | R | A | A | R | R | A |
| Seeds changed | - | - | - | R | - | - | - | - | - |
| Dependencies | - | - | - | - | R | A | A | A | A |
| Claims touched | A | A | - | - | - | - | R | R | A |
| Platform evidence | A | - | - | - | A | R | R | R | A |
"""

with open(r'H:\folderrr\docs\pr.md', 'w', encoding='utf-8') as f:
    f.write(part1)

print("Part 1 written:", len(part1))