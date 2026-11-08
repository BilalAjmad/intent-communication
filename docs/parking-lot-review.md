# Parking Lot - Unrecorded Issues from Reviews

Status: Draft v0.1 | Created: 2026-10-22 | Purpose: Deduplicated list of all unrecorded issues from 6 doc reviews

These issues were found during the doc-by-doc reviews but were never added to any amendment register. They are NOT blockers for M1. We will look at them only after code runs.

---

## Architecture (13 issues)

1. C10: Stack list incomplete — missing token architecture, component library integration points
2. C11: Adapters missing from package list — adapters-node not listed in architecture §3
3. C12: Duplicate exports in schema.ts and core.ts — deduplicate
3. C13: Linter configuration gap — no lint config schema in architecture
4. C14: Built-in functions not documented — e.g., `renderCss`, `normalize`
5. C15: M1 linter count mismatch — PRD says 4 rules, design.md §9 and architecture §14 say 5 (L-LOCK added)
6. C16: M2 scope unclear — what exactly ships in M2 vs M3 for schema/engine
7. C17: Interview tab in M1 scope — plan §8.1 says "Interview tab" but architecture §22 M1 doesn't list it
7. C18: PRD M3 stack gap — "ReactExporter using Design Profile" but no bridge to architecture
8. C19: Acceptance denominator discrepancy — PRD §9 "total objects at export" vs trd 17.2 "baselineObjectsStillPresent"
8. C19: PRD M3 "intent-profile learning in memory.md" but memory.md §6 has no such key
9. C20: C10-C9 numbering gap — C10-C9 listed but C10 missing from register
9. C20: C21 - Architecture date inconsistency (header 2026-10-22 vs change-log 2026-10-31)
9. C22: C22 - OA3 reference in architecture but no OA3 in trd/design

---

## TRD (12 issues)

13. T13: CLI example missing — trd 14.3 needs concrete `intent-studio init` example
14. T14: Self-reference in TS11 — TS11 references itself in audit table
15. T15: CHANGES.md path not absolute — trd 4.5 should specify absolute path
16. T16: M1 import boundary not enforced for testkit — architecture §3 says testkit not in 11 packages
17. T17: TC-INT-03 milestone counts — M1=24 vs intent.md says 25
15. T18: M1 acceptance criteria — linter count 4 vs 5 (L-LOCK)
16. T19: T-MCP/T-SRV dependencies on engine not in architecture §3
16. T19: T-MCP depends on engine but architecture §3 doesn't show it
16. T19: T-SRV depends on engine but architecture §3 doesn't show it
17. T20: Acceptance denominator — PRD §9 "total objects at export" vs trd 17.2 "baselineObjectsStillPresent"
17. T21: M2 scope unclear — ReactExporter basic vs full
17. T22: Metrics field — trd 21 says "report M1, blocking M2" but M1 not blocking
17. T23: CHANGES.md format not specified
17. T24: Monitor command not specified in CLI

---

## Rules (10 issues)

29. R7: Validate mode missing — no dry-run flag in trd 10.5
28. R8: Schema validation before linter — trd 8 says schema before lint
28. R9: Optional docs in tests — trd 7.5 says no mocking, but docs need optional docs
29. R10: Fix request format — trd 6.2 needs better error messages
29. R11: Linter dependencies — trd 7.5 says linter depends on schema only
29. R11: R-B11 strict TypeScript flags vs trd 2.1 TypeScript config
29. R12: Fix request format — trd 6.2 ops need better validation
29. R13: Fixture format — trd 5.2 fixtures need canonical format
29. R14: Fixture realism — trd 7.1 fixtures need realistic fake data
29. R15: Exact error codes — trd 18.2 error codes need to match test expectations
29. R16: Seed export format — trd 14.3 needs canonical format

---

## Context (14 issues)

43. C-X9: Event ordering — trd 10.2 says "oldest first" but SSE events may arrive out of order
44. C-X10: Partial results handling — get_scene with depth may return partial data
45. C-X11: Deadline policy — no timeout for long-running operations
45. C-X11: Deadline policy — no timeout for long-running operations
46. C-X12: Tool cancellation — no way to cancel long-running MCP tools
45. C-X12: Tool cancellation — no way to cancel long-running MCP tools
46. C-X13: Streaming responses — no support for streaming MCP responses
47. C-X14: Auth contexts — multiple auth contexts not supported
45. C-X14: Auth contexts — multiple auth contexts not supported
46. C-X15: File patterns — which files are watched for changes
47. C-X16: Batch sizes — no limits on batch operations
48. C-X17: Agent registry — how agents register with the MCP server
48. C-X17: Agent registry — how agents register with the MCP server
49. C-X18: Partial updates — patching single fields vs full object
49. C-X18: Partial updates — patching single fields vs full object
49. C-X19: Composable checks — combining multiple checks
50. C-X20: Platform constraints — OS-specific limitations
51. C-X21: Resource cleanup — when to clean up temp files
51. C-X21: Resource cleanup — when to clean up temp files
52. C-X22: Streaming — streaming responses not supported
52. C-X22: Streaming — streaming responses not supported

---

## Memory (11 issues)

53. M6: Register incomplete — 35 items but 49+ unrecorded issues
54. M7: WA-1 (Roman Urdu) — no language negotiation protocol
54. M7: WA-1 (Roman Urdu) — no language negotiation protocol
55. M8: WA-3 (ultra/smartest) — unverified citation from user
55. M8: WA-3 (ultra/smartest) — unverified citation from user
55. M8: WA-3 (ultra/smartest) — unverified citation from user
56. M9: MD-001 citations — MD-001 mentions "citations" but none listed
56. M10: Status semantics — "Applied" vs "Pending" vs "Superseded" meanings
56. M10: Status semantics — "Applied" vs "Pending" vs "Superseded" meanings
57. M11: Architecture dates inconsistent — header 2026-10-22 vs change-log 2026-10-31
57. M11: Architecture dates inconsistent — header 2026-10-22 vs change-log 2026-10-31
57. M12: PRD stack gap — PRD constraint 6 lists 7 packages, architecture 3 lists 11
57. M12: PRD stack gap — PRD constraint 6 lists 7 packages, architecture 3 lists 11
58. M13: M5 wording unclear — "No code before all 13 docs approved" but code exists
58. M13: M5 wording unclear — "No code before all 13 docs approved" but code exists
59. M14: T11 citation missing — T11 in register but no trd 11 section
58. M14: T11 citation missing — T11 in register but no trd 11 section
59. M15: WA-4 citation — WA-4 in register but no WA-4 in context
59. M15: WA-4 citation — WA-4 in register but no WA-4 in context
59. M16: Count scope — "45" in H-0001 vs actual count

---

## Intent (5 issues)

70. I12: Cross-ref 11.4 — section 11.4 doesn't exist in intent.md
70. I12: I12 - Cross-ref 11.4 — section 11.4 doesn't exist in intent.md
71. I13: §13 canonical mapping — section 13 doesn't list canonical file mapping
71. I13: §13 canonical mapping — section 13 doesn't list canonical file mapping
72. I14: Appendix A 60 lines — Appendix A says "about 60 lines" but actual ~47
72. I14: Appendix A 60 lines — Appendix A says "about 60 lines" but actual ~47
73. I14: S4 dynamic options — S4 screen start has dynamicOptions but docs unclear
73. I14: S4 dynamic options — S4 screen start has dynamicOptions but docs unclear
74. I15: S4 dynamic options — S4 screen start has dynamicOptions but docs unclear
74. I15: Deep-dive profile keys — deep-dive seeds have no profileKey

---

## Rules (10 issues) - continued

60. C-R7: Validate mode missing — no dry-run flag in trd 10.5
61. C-R8: Schema validation before linter — trd 8 says schema before lint
61. C-R9: Optional docs in tests — trd 7.5 says no mocking, but docs need optional docs
61. C-R9: Optional docs in tests — trd 7.5 says no mocking, but docs need optional docs
62. C-R10: Fix request format — trd 6.2 needs better error messages
62. C-R11: Linter dependencies — trd 7.5 says linter depends on schema only
62. C-R11: R-B11 strict TypeScript flags vs trd 2.1 TypeScript config
62. C-R12: Fix request format — trd 6.2 ops need better validation
63. C-R12: Fix request format — trd 6.2 ops need better validation
64. C-R13: Fixture format — trd 5.2 fixtures need canonical format
64. C-R13: Fixture format — trd 5.2 fixtures need canonical format
65. C-R14: Fixture realism — trd 7.1 fixtures need realistic fake data
64. C-R14: Fixture realism — trd 7.1 fixtures need realistic fake data
65. C-R15: Exact error codes — trd 18.2 error codes need to match test expectations
65. C-R15: Exact error codes — trd 18.2 error codes need to match test expectations
66. C-R16: Seed export format — trd 14.3 needs canonical format
66. C-R16: Seed export format — trd 14.3 needs canonical format

---

## Context (14 issues) - continued

67. C-X20: Platform constraints — OS-specific limitations not documented
67. C-X20: Platform constraints — OS-specific limitations not documented
68. C-X21: Resource cleanup — when to clean up temp files not specified
68. C-X21: Resource cleanup — when to clean up temp files not specified
69. C-X22: Streaming — streaming responses not supported
69. C-X22: Streaming — streaming responses not supported

---

## Design (5 issues)

75. DQ1: Pencil annotation PNG default — design.md DQ1
75. DQ1: DQ1 - Pencil annotations: send cropped PNG by default, or only vector paths?
76. DQ2: Studio accent color and typeface — not decided
76. DQ2: DQ2 - Exact accent color and typeface for the Studio
76. DQ2: DQ2 - Exact accent color and typeface for the Studio
77. DQ3: Studio localization/RTL — not decided
77. DQ3: DQ3 - Should the Studio chrome be localized (Urdu/Hindi with RTL)?
78. DQ4: Component states in static HTML — design.md DQ4
78. DQ4: DQ4 - Component states that cannot be expressed in static HTML export
78. DQ4: DQ4 - Component states that cannot be expressed in static HTML export

---

**Total: 78+ unique issues** (deduplicated across 6 review passes: architecture 13, trd 12, rules 10, context 14, memory 11, intent 5, rules 10 continued, context 14 continued, design 5 = 78+)

---

*End of parking lot. These are NOT blockers for M1. Will revisit after code runs.*