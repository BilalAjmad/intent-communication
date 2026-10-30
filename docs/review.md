# review.md: Intent Review Specification

Status: Draft v0.2 | Created: 2026-10-29 | Depends on: prd.md, design.md, architecture.md, trd.md, rules.md, context.md, memory.md, intent.md, plan.md, test.md, loop.md (all v0.1)

This document defines how changes, documents, milestones and releases are reviewed by someone other than the author, what the reviewer checks, how findings are written and closed, and which claims the project may make. It extends the author's self-review (loop.md section 12, SR-01 to SR-11) and never contradicts it.

Section numbers are stable anchors (context.md CX-08). New content is appended, never renumbered.

---

## 1. Purpose and Principles

| ID | Principle |
|----|-----------|
| RP-01 | **Independence beats thoroughness.** A reviewer who did not write the change sees what the author cannot. A longer checklist does not replace that |
| RP-02 | **Evidence, not opinion.** Every finding names a rule or spec ID and shows evidence: a command result, a file and line, or a doc section. Cite docs by section, never copy their text (CX-13) |
| RP-03 | **The reviewer re-runs.** A report is a claim. The reviewer reproduces the checks that matter (LP-03, R-B08) |
| RP-04 | **Tests first.** Read the tests before the code. Ask whether each test could fail (TP-02) |
| RP-05 | **Review against the spec, not against the author's intent.** If code and docs disagree, the docs win until changed through a ruling (R-B01) |
| RP-06 | **One session must be enough.** A change that cannot be reviewed in one session is too big. Request a split (PL-01) |
| RP-07 | **Severity measures harm, not effort** (section 13) |
| RP-08 | **The reviewer fixes nothing.** The author fixes. This keeps the roles clear and the evidence clean |
| RP-09 | **A review is not a decision.** Scope, rulings, waivers, tags and publishing belong to the user (PL-10, R-B33, MR-03) |
| RP-10 | **Proportional depth.** High-risk areas get deep review. Documents get document review. Docs-only changes do not get code checklists |
| RP-11 | **No finding without a way to verify the fix** |
| RP-12 | **Say what was not reviewed.** Every review ends with a "Not reviewed" line (section 14) |

Requirements this document resolves:

| Source | Resolved in |
|--------|-------------|
| rules: checklist from R-B and R-G05 | 9, 7 (GR-08) |
| context: pack named in report, no doc text copied | 4 (RV-04, RV-05) |
| intent: QR-01 to QR-12, no free text in profile keys | 5.10, 5.11 |
| memory: Pending items, UNVERIFIED rows at milestone end | 7 (GR-05, GR-06) |
| plan: gate checklist (8.7, 11), PL-11, never-cut list (8.4) | 7 |
| test: thresholds, goldens, quarantine, smoke age, README claims | 4, 7, 10 |
| loop: SR items, stop reports, CI-confirmed evidence, trigger audit | 4, 7, 8 |

## 2. Review Kinds and Triggers

| Kind | Name | When | Checklists | Output |
|------|------|------|-----------|--------|
| A | Change review | After a task's commits are green locally, before the change is merged to the integration branch by the user | 4, one of 5.x | Verdict and findings (14.1) |
| B | Document review | Any change to a doc, a Phase 0 document, or an application of rulings (Step R) | 6 | Verdict and findings |
| C | Gate review | The end of each milestone (plan S-1-15, S-2 gate, S-3 gate) | 7, 8, 9, 10 | Gate report (14.2) |
| D | Release review | Before the user tags a release | 12, 10 | Release report |
| E | Claims review | Whenever README, docs claims, CLI help, Studio strings, error messages or release notes change, and inside C and D | 10 | Findings |
| F | Security-focused review | When a diff touches a security-sensitive area (below), and inside C | 11 | Findings |

### 2.1 High-risk areas

A change that touches any of these is **high risk**:

`packages/core`, `packages/adapters-node`, `packages/server`, `packages/mcp-server`, `packages/engine` (normalize, exporters, preview runtime), `packages/skills` (generator and canonical rule files), `packages/schema` (grammars and limits), the accessibility rules of `packages/linter`, `packages/scanner` (M3), CI workflows and CI checks, and any guarded file (V3).

Everything else is **normal risk**. A docs-only change is reviewed as kind B.

### 2.2 Security-sensitive areas (kind F)

The server (auth, headers, routes), `FileAdapter` and path handling, locks and the write pipeline, the preview iframe and message protocol, exporters (escaping and URL allowlists), the generator's merge logic, `open_studio` and any process spawn, the Scanner, canonical rules that state the untrusted-data stance, and any dependency addition.

### 2.3 Independence level (proposal V1)

| Level | What it is | Used for |
|-------|-----------|----------|
| L1 | Author self-review (loop.md section 12) and CI | Every commit |
| L2 | Independent review by a fresh session that did not write the change, read-only, using pack T-REVIEW | Every high-risk change, and every gate |
| L3 | The user decides. At v1.0.0 an independent human security review is recommended (test TQ12) | Gates, releases, any dispute |

Until the user rules on V1, the agent treats L2 as required for high-risk changes and for gates, and reports when it was not possible.
## 3. Method

### 3.1 Roles

| Role | Who | Can |
|------|-----|-----|
| Author | The session that wrote the change | Fix findings, rebut with evidence, split the change |
| Reviewer | A fresh session. A different agent or vendor than the author is preferred (VQ1) | Read, run checks, write the review report |
| User | The person | Rule on disputes and waivers, accept or reject findings, merge, tag |

## 4. Universal Checklist (every kind A review)

Items tagged `[dep: ID]` apply only when that amendment is Applied. Until then they are reported as "not applicable yet" (V12).

| ID | Check | Reference |
|----|-------|-----------|
| RV-01 | The change matches one plan step. The PR or report names the step ID and the acceptance criteria it serves. Nothing outside scope was added (R-B06). Parking-lot ideas were not implemented | plan PL-01, R-B06 |
| RV-02 | The reviewer re-checked **SR-01 to SR-11 independently** (not by copying the author's answers) | loop 12 |
| RV-03 | The reviewer re-ran the affected rungs. Results match the report. Anything the author called "passing" but did not run is a finding | loop 5, R-B08 |
| RV-04 | The report is complete: R-B39 fields, the ledger, reruns, tree state. A "Context loaded" line `[dep: C-X7]`. A `Step:` line and loop stats `[dep: L7, L9]`. The status word is honest: **Done (local)** unless CI evidence exists | R-B39, loop 3.1 |
| RV-05 | The pack named is plausible for the change. No doc text was copied into code, comments, tests or rule files. (Search the diff for long word sequences from the docs. Any tool is fine) | CX-13, SR-09 |
| RV-06 | No doc was edited without an Accepted ruling and a dated change-log entry. Section numbers are unchanged (TC-DOC-05). Status words in memory.md were not set by the agent | R-B38, MR-03 |
| RV-07 | Code and spec agree. If they do not, the code is the finding, not the doc | R-B01 |
| RV-08 | Commits: conventional, one concern, `Step:` line, no red commit. At least the tip commit is green. Any commit that adds tests without code, or code without tests, is inspected | R-B34, loop 4.3 |
| RV-09 | No new `TODO` without a plan item, no dead code, no commented-out code, no `any`, no `@ts-expect-error` without a reason | R-B11, R-B19 |
| RV-10 | No guarded file changed without a `Ruling:` reference (thresholds, budgets, coverage gates, perf baseline, rule maps, lint config, CI workflows) `[dep: V3]`. Until then the reviewer checks by hand | TP-11, ST-15 |
| RV-11 | Any claim added to a README, doc, CLI text, Studio string or error message passes section 10 | section 10 |
| RV-12 | Memory is updated: decisions with a doc section, verified facts with date and source, lessons for any stop. The handoff exists and "Next step" is specific | R-B37, context 7.3 |
| RV-13 | The ledger shows no forbidden fix (LC-10): no weakened test, raised tolerance, disabled rule, swallowed error, unreviewed golden update, mock of the unit under test | LC-10 |
| RV-14 | A stop trigger that should have fired did not get ignored (for example the third occurrence of one failure, or a dirty tree). If one fired, the stop report exists | loop 7, section 8 |

## 5. Checklists by Change Type

Format: **ID | Check | Verified by**. The "Verified by" column names a test or the evidence the reviewer collects. A high-risk change also needs R6 (spot mutation) for its guards.

### 5.1 `schema`

| ID | Check | Verified by |
|----|-------|-------------|
| CK-SCH-01 | Every object schema is strict. Unknown keys are rejected | TC-SCH-02 with an extra-key fixture |
| CK-SCH-02 | No free-form CSS, URL or HTML field was added. New strings use a closed grammar or a bounded `Text` | Diff against trd 4.1 and 4.3 |
### 5.5 `engine` and exporters

| ID | Check | Verified by |
|----|-------|-------------|
| CK-ENG-01 | `normalize` is pure and does not mutate its input | TC-ENG-01 |
| CK-ENG-02 | The CSS value allowlist is unchanged. Any widening needs a ruling and an injection test | TC-ENG-05 |
| CK-ENG-03 | Text, attributes, ids, class names and title are escaped. URLs are limited to `#s-` links and allowed `data:` images | TC-ENG-04 |
| CK-ENG-04 | The attribute allowlist is unchanged, or ruled | TC-ENG-07 |
| CK-ENG-05 | No external URL or network request in any output | TC-ENG-06, 08 |
| CK-ENG-06 | Same input gives the same bytes. No clock, environment or randomness | TC-ENG-03 |
| CK-ENG-07 | Golden changes are minimal, in one area, with a `CHANGES.md` line. The reviewer **read the diff**, not only the fact that it changed | R-B27, test 4.5 |
| CK-ENG-08 | The preview and the export share `renderCss`. The visual test passes with unchanged thresholds, and all five deliberate-failure mutations are still detected | TC-VIS-01, 02 |
| CK-ENG-09 | No editor artifact leaks into output. Locks do not change export | TC-ENG-13, 14 |
| CK-ENG-10 | SVG assets are still rejected `[dep: P10]` | Test or code |

### 5.6 `mcp-server`

| ID | Check | Verified by |
|----|-------|-------------|
| CK-MCP-01 | Exactly six tools with the PRD FR-S1 names `[dep: C2]` for any other count | TC-MCP-13 |
| CK-MCP-02 | Envelope and error mapping follow trd 10.1 and 18.2. `isError` is set on failure | TC-MCP-01, 02, 03 |
| CK-MCP-03 | Descriptions are at most 120 words each and 700 in total. `describe()` strings are at most 15 words | TC-MCP-09 |
| CK-MCP-04 | Free text appears only in named data fields. Tool descriptions mark such fields as untrusted data | TC-MCP-10 |
| CK-MCP-05 | `open_studio` still needs `userRequested: true` and a non-empty `quote`. The MCP server never launches a browser. Any spawn follows CK-SEC-06 | TC-MCP-08 |
| CK-MCP-06 | Nothing but protocol messages goes to stdout | TC-MCP-13 |
| CK-MCP-07 | Response caps and `maxBytes` are respected `[dep: C-X1]` | TC-MCP-04 |
| CK-MCP-08 | The server holds no state between calls | TC-MCP-12 |
| CK-MCP-09 | `ask_user`: fixed lines appended by the server, meter cap applied, delegation list checked, `since` gating on seeds | TC-INT-05, 09, 10, 16 |
| CK-MCP-10 | No tool writes anywhere except through `core` | CK-COR-01 |

### 5.7 `server` (Studio server)

| ID | Check | Verified by |
|----|-------|-------------|
| CK-SRV-01 | Binds loopback only. No option allows another host | SEC-01 |
| CK-SRV-02 | Session cookie, Host and Origin checks on every route. No CORS headers | SEC-02 to SEC-05 |
| CK-SRV-03 | Token exchange as in trd 11.2. Constant-time comparison. The token never appears in logs, errors or files | SEC-06, CK-SEC-04 |
| CK-SRV-04 | Every route validates its body with Zod. Size limits hold | TC-SRV-02, 03 |
| CK-SRV-05 | IDs from routes are matched against the ID regex before they touch a path | SEC-07 |
| CK-SRV-06 | The server never starts without an explicit command | TC-SRV-06 |
| CK-SRV-07 | Idle shutdown removes `runtime.json`. A dead pid is detected | TC-SRV-05 |
| CK-SRV-08 | Security headers on every response, `no-store` on `/api` | TC-SRV-07 |
### 5.2 `core`

| ID | Check | Verified by |
|----|-------|-------------|
| CK-COR-01 | Every write still goes through the single pipeline. No new caller of a write method outside `core` | grep, R-B15 |
| CK-COR-02 | Pipeline order is kept: cheap, certain checks (scope, existence, conflict, lock) run before schema and lint | TC-COR-17 |
| CK-COR-03 | The lock check runs inside the same critical section as the write | Code reading, TC-WRT-08 |
| CK-COR-04 | Touched-set and `rev` rules are unchanged, or a ruling is cited | TC-COR-05, 06 |
| CK-COR-05 | A failed write leaves every file byte-identical, except the patch file's status | TC-COR-18 |
| CK-COR-06 | Purity: time and IDs come from ports. No `fs`, `Date.now`, `Math.random`, `process.env` | TC-COR-19, TC-CIC-03 |
| CK-COR-07 | A new op or path updates the whitelist and the scope rule, and has attack-case tests | TC-COR-02, 03, 04 |
| CK-COR-08 | Locks cannot be bypassed by ancestor patches, move, add or remove | TC-COR-08 |
| CK-COR-09 | Errors are typed, have hints, and carry no stack trace in agent-facing output | TC-MCP-02 |
| CK-COR-10 | Time-based logic (stale lock) uses the injected clock, not real waiting | TC-FS-05 |

### 5.3 `adapters-node` and file safety

| ID | Check | Verified by |
|----|-------|-------------|
| CK-FS-01 | Every path is resolved and confined to `.intent/`. Symlinks are refused for each path component, on reads and writes `[dep: TS4]` | TC-FS-01, TC-FS-02 |
| CK-FS-02 | Atomic write order: temp file, fsync, rename. Windows retry schedule as in trd 9.1 | TC-FS-03, TC-FS-04 |
| CK-FS-03 | Lock: exclusive create, owner token, release only by the owner, stale rules per trd 9.2 | TC-FS-05, 06 |
| CK-FS-04 | No file-system API is used outside `adapters-node` | grep, boundary check |
| CK-FS-05 | File modes (for example 0o600 for `runtime.json`) are set | TC-FS-09 |
| CK-FS-06 | Behavior on each operating system is shown by **CI results from that system**, not by reasoning | CI run records, loop L4 |

### 5.4 `linter`

### 5.8 `studio` (UI)

| ID | Check | Verified by |
|----|-------|-------------|
| CK-STU-01 | The preview iframe has exactly `sandbox="allow-scripts"`, a `srcdoc` and the CSP of trd 12.1. A change to any of these needs a ruling | TC-STU-01 |
| CK-STU-02 | Messages are accepted only from the right `event.source` with the right channel and a valid shape | TC-STU-02 |
| CK-STU-03 | No banned sink (`innerHTML` and the rest), except the one audited file | TC-CIC-02 |
| CK-STU-04 | The UI reaches the disk only through `BridgeAdapter`. No Node import | Boundary check |
| CK-STU-05 | Keyboard operable. The Layers tree matches canvas selection. Focus order follows design 8 | TC-STU-03, 04 |
| CK-STU-06 | Status uses icon plus text, never color alone. A live region announces changes | TC-STU-05 |
| CK-STU-07 | Axe reports no critical or serious issue. Reduced motion is respected | TC-STU-07 |
| CK-STU-08 | New user-visible strings go through the message catalog `[dep: P7]`, in calm plain language, without emoji in system messages | R-B23, design 7 |
| CK-STU-09 | Empty, loading and error states exist for new views | TC-STU-06 |
| CK-STU-10 | Editor overlays stay outside the RenderModel and never reach an export | TC-VIS-04, TC-ENG-13 |

### 5.9 `skills`, generator, canonical rule files

| ID | Check | Verified by |
|----|-------|-------------|
| CK-GEN-01 | Only the canonical source was edited. Generated files were regenerated, never hand-edited. Drift passes | TC-GEN-01 |
| CK-GEN-02 | Every Part B rule that applies at this milestone has a marker. No unknown rule ID | TC-GEN-02 |
| CK-GEN-03 | Line budgets hold (always files 200 in total, intent-core 90, tool-usage 110, design-principles 150, studio 100) | TC-GEN-03 |
| CK-GEN-04 | Files are thin: they say WHEN and WHICH TOOL, never HOW a tool works | R-C01 |
| CK-GEN-05 | Each always file opens with the five top rules (R-C07). The five error-prone rules have an example and an anti-example (R-C03) | Reading |
| CK-GEN-06 | No agent-specific wording, no token, no URL with a token, no date, no scene data | TC-GEN-08, 09 |
| CK-GEN-07 | `merge-block` leaves user content byte-identical. It is idempotent, refuses damaged markers, and `--dry-run` writes nothing | TC-GEN-05, 07 |
| CK-GEN-08 | `merge-json` keeps other servers and keys, and changes only the `intent` entry | TC-GEN-06 |
| CK-GEN-09 | Format facts for each agent were verified and recorded in `docs/versions.md` with date and source (R-B07). The adapter header carries them | `docs/versions.md` |
| CK-GEN-10 | The untrusted-data stance (R-R24) and the Studio rule (R-R28) are still present | TC-GEN-02 |
| CK-GEN-11 | A Part B rule change follows R-G02: change-log entry, user approval, regenerated files in the same commit | R-G02 |

### 5.10 Interview bank (seeds)

| ID | Check | Reviewer asks |
|----|-------|---------------|
| CK-BNK-01 (QR-01) | One slot per question | Does the text ask about exactly one decision? |
| CK-BNK-02 (QR-02) | Plain words, visible examples | Would a non-designer understand every option without a glossary? |
| CK-BNK-03 (QR-03) | 2 to 5 options, mutually exclusive unless `multi`, covering the likely space | Is any common answer missing? Do two options overlap? |
| CK-BNK-04 (QR-04) | Neutral wording, no "recommended", no leading | Is one option worded more attractively than the rest? |
| CK-BNK-05 (QR-05) | Not double-barreled | Could one answer be true for half the question? |
| CK-BNK-06 (QR-06) | Does not ask what is already known | Is this slot reachable from prompt, scene, brief, profile or earlier answers? |
| CK-BNK-07 (QR-07) | Does not ask about a capability the milestone cannot deliver (`since`) | Can the product act on every option at that `since`? |
| CK-BNK-08 (QR-08) | `whyAsked` states the effect and fits 200 characters | Does it say what changes in the result? |
| CK-BNK-09 (QR-09) | Options describe visible outcomes | Are any options bare adjectives? |
| CK-BNK-10 (QR-10) | Never asks for secrets, credentials, real personal data or real names | Could an answer contain any of these? |
| CK-BNK-11 (QR-11, SC-5) | No slot is asked twice without `reopen` | Does any seed map to a slot that another seed owns? |
| CK-BNK-12 (QR-12) | Question language follows the chat. Prototype text language is its own slot | Are the two mixed up anywhere? |
### 5.11 Intent profile (M3)

| ID | Check | Verified by |
|----|-------|-------------|
| CK-PRF-01 | Keys and values come from the closed lists (intent 11.2). **No path exists for free text** into `signals.json` or `profile.json` | TC-PRF-03 |
| CK-PRF-02 | Promotion rules PR-1 to PR-8 are unchanged or ruled | TC-PRF-01 |
| CK-PRF-03 | The edit mapping table (intent 11.4) is unchanged. Ambiguous actions create no signal | TC-PRF-02 |
| CK-PRF-04 | A signals write failure never fails the main write | TC-PRF-04 |
| CK-PRF-05 | The user can view, edit, delete, forget all and switch learning off | TC-STU-17 |
| CK-PRF-06 | The agent cannot write either file (R-R36). No tool or route allows it except the documented profile routes under the user's session | Code reading |

### 5.12 `cli`

| ID | Check | Verified by |
|----|-------|-------------|
| CK-CLI-01 | `init` is idempotent. `--dry-run` writes nothing | TC-GEN-05, 07 |
| CK-CLI-02 | Only project files are edited. Global agent configs are never touched (R-B31) | Code reading, TC-GEN-06 |
| CK-CLI-03 | Exit codes match the table | TC-GEN-12 |
| CK-CLI-04 | `doctor`: reports Node version, writability, atomic rename and lock probe, port binding, drift and agent config presence. Each failing condition returns exit code 3 with a fix | TC-GEN-11 |
| CK-CLI-05 | Nothing starts the Studio except `open` and `open_studio` | TC-SRV-06 |
| CK-CLI-06 | No network call | SEC-13 |

### 5.13 CI checks and workflows

| ID | Check | Verified by |
|----|-------|-------------|
| CK-CIC-01 | A new or changed check has a bad fixture, and the check was seen failing on it (TP-02) | TC-CIC proof job |
| CK-CIC-02 | Blocking jobs cannot be skipped or made non-blocking by an environment flag, `continue-on-error`, or a path filter that hides code | Workflow reading |
| CK-CIC-03 | The matrix covers Linux, macOS and Windows where the plan requires | CI config |
| CK-CIC-04 | No check was softened (pattern widened, path excluded, severity lowered) without a ruling | Diff, RV-10 |
| CK-CIC-05 | No secret in a workflow. Permissions are the least the provider allows (verify the provider's options at S-0-02) | Workflow reading |
| CK-CIC-06 | Dependencies of the pipeline are pinned (R-B29) | Diff |

### 5.14 Dependencies

| ID | Check | Verified by |
|----|-------|-------------|
| CK-DEP-01 | A row exists in `docs/versions.md`: what, why, license (MIT-compatible), size, maintenance, verified version, date, source | `docs/versions.md` |
| CK-DEP-02 | Exact pin, lockfile updated, audit clean | CI |
| CK-DEP-03 | A standard-library or in-repo alternative was considered (R-B29) | Report |
| CK-DEP-04 | Install scripts were reviewed. None are allowed by default | Lockfile and package metadata |
| CK-DEP-05 | The dependency is added in its own commit | Git log |
| CK-DEP-06 | It is not imported into a browser-safe package unless it is browser-safe | Boundary check |

### 5.15 Tests-only changes

| ID | Check | Verified by |
|----|-------|-------------|
| CK-TST-01 | Each new test has a TC ID that appears in test.md, and no test lacks one | TC-DOC-07 |
| CK-TST-02 | The test fails when the behavior is broken (R5, R6) | Red check |
| CK-TST-03 | No `sleep`, no real clock, no real randomness, no network | Reading |
| CK-TST-04 | The unit under test is not mocked | R-B25 |
## 6. Document Review (kind B)

### 6.1 Phase 0 documents and any doc change

| ID | Check |
|----|-------|
| DR-01 | Header has Status, Created date and Depends on. The "Created" and change-log dates equal the real system date when written (memory M5). No hard-coded "today" |
| DR-02 | Sections are numbered. Existing numbers did not move (CX-08, TC-DOC-05). New content is appended |
| DR-03 | Every section, rule and test ID it references exists in the referenced doc (CX-10). The reviewer spot-checks at least 10 references and all references in changed text |
| DR-04 | The doc has no placeholder, "TBD" without an owner, or lorem text. Open questions have IDs and owners |
| DR-05 | A Conflicts section lists every contradiction found, with IDs that do not reuse an old ID, and a recommendation (accept, decide, info). Nothing in an earlier doc was edited (R-B38) |
| DR-06 | Counts (items, rules, tests, seeds) are computed from a register, not typed by hand (memory M5). The reviewer recomputes at least one |
| DR-07 | The 5-line summary matches the document. Claims in the chat message are in the doc, and vice versa |
| DR-08 | Honest limits are stated. No claim stronger than the evidence (section 10) |
| DR-09 | No secrets, tokens or personal data (MR-05, R-B28) |
| DR-10 | The doc does not set a status (Accepted, Applied, Rejected) on anything (MR-03) |
| DR-11 | The doc stays inside its job. It does not decide something that belongs to another doc without listing it as a conflict |

### 6.2 Applying rulings (Step R and later)

| ID | Check |
|----|-------|
| AR-01 | For each Applied item there is a user ruling with a date in memory.md (MR-03) |
| AR-02 | A dated change-log entry exists in the affected doc, and the doc version was raised |
| AR-03 | Status Applied was set only after the change-log entry. Rejected items left the original text unchanged |
| AR-04 | The changes are exactly what the ruling said. A "accept except X" ruling excluded X |
| AR-05 | No renumbering. Retired sections are marked Retired |
| AR-06 | The consistency check was re-run: references, packs, register IDs, budgets. Results are recorded |
| AR-07 | The Pending count after the pass is computed from the register and matches the number of rows with that status |
| AR-08 | Items that depended on a ruling that was rejected are re-examined, for example the fallback named in intent.md if I1 or I2 is rejected |

## 7. Gate Review (kind C)
### 7.2 Gate checklist

Result words: **Met**, **Not met**, **Not applicable yet** (with the dependency), **Not run**.

| ID | Check | Evidence needed |
|----|-------|-----------------|
| GR-01 | Every acceptance criterion of the milestone (AC-M1-01 to 13 for M1) has evidence, and its step is **Done (CI-confirmed)** `[dep: L4]`. Until L4 is ruled, items that need CI are reported "awaiting CI" and the gate cannot pass on them | Test run records, CI run identifiers recorded by the user or the agent that was allowed to push |
| GR-02 | Demos A to D (M1) or the milestone demo were run and recorded | Transcript or notes in `tests/smoke/` |
| GR-03 | Tier 1 smoke records exist for the current release for each claimed agent, with agent version, date, OS and result. A Fail on lines 3, 4, 9, 11, 12 or 13 is resolved, or the README support claim was changed to match (test 8.2) | `tests/smoke/` files, README |
| GR-04 | The visual calibration record is under 90 days old. The flake counter shows 20 stable scheduled runs on the pinned Linux runner (TC-VIS-03, test 12.4) | `docs/versions.md` or memory facts |
| GR-05 | **Pending amendments**: list every Pending item older than this milestone. Each is ruled, or has a written reason to wait (memory section 12). The count is computed from memory.md section 6 | List and count |
| GR-06 | **UNVERIFIED rows** in memory section 7: list all. Any row that code depends on is verified. Rows older than 90 days are re-checked | List with dates |
| GR-07 | **Waivers** in memory section 10: list. Each has date, reason, grantor, expiry. None covers an unwaivable rule (R-B28, R-B30, R-R23, R-R24, R-R33). None is expired but still used | List |
| GR-08 | **Rules broken twice** (R-G05): count findings, stop reports and lessons by rule ID across the milestone. A rule with two or more separate violations is a candidate for stronger enforcement (section 9.3). Proposals are written under R-G03 | Table |
| GR-09 | **Stops**: count by trigger ID (section 8). Each stop report is resolved. No lesson stub `LS-n (open)` remains. A repeated trigger gets a proposal | Table |
| GR-10 | **Planned versus actual** (PL-11): steps, sessions, attempts, reruns, cuts and late defects per step. Size guesses for the next milestone are corrected (PL-02) | Table |
| GR-11 | **Cut line** (plan 8.4): no "never cut" item was cut. Every cut is a change-log entry and not half-built (R-B03) | Diff and plan change-log |
| GR-12 | **Quarantine**: at most 3 tests, none security or concurrency, none older than one milestone | Test list |
| GR-13 | **Claims review** (section 10) of README, release notes, CLI help, Studio strings | Findings |
| GR-14 | **Security**: SEC-01 to SEC-14 results are present, and kind F was done for security-sensitive changes. Independent external review status is stated (test TQ12) | Results, 11 |
| GR-15 | **Docs**: change-log entries exist for every changed doc. `docs/INDEX.md` is fresh. Section numbers are stable. The reviewer spot-checks at least 5 behaviors in the code against the docs | Checks |
| GR-16 | **Quality gates**: coverage (TS12), budgets, drift, coverage-of-rules, and from M2 the performance baseline | CI results |
| GR-17 | **Dependencies**: `docs/versions.md` is complete. Audit is clean. Licenses are compatible | File, audit |
| GR-18 | **Clean machine and stranger test**: the run from a clean machine and the stranger result are recorded as **measured** (median, range, n), not claimed (test 8.3) | `tests/smoke/` |
| GR-19 | **Memory and handoff**: decisions recorded, late-defect lessons written, newest handoff within 60 lines | memory.md |
| GR-20 | **Release candidate** is prepared (changelog, version, notes) and **not** triggered. No tag, push or publish happened without the user (R-B33, PL-10) | git log, tags |

### 7.3 Gate decision table

| Findings | Recommendation |
|----------|----------------|
## 8. Stop-Trigger Audit

At each gate the reviewer lists every time each trigger fired (from stop reports and handoffs) and checks that the response matched loop.md section 7.

| Trigger | What the reviewer looks for |
|---------|-----------------------------|
| ST-01 | Steps started before Ready. A step with no listed failing tests or no acceptance criteria |
| ST-02 | A fingerprint with three or more occurrences and no stop report |
| ST-03 | A check that failed five or more times in one task without a stop |
| ST-04 | A doc conflicts with another doc, a pack section is missing, or the docs are ambiguous on a point that changes behavior |
| ST-05 | A step with three or more handoffs and no split. A size L step that was started |
| ST-06 | A version or format used while its row is UNVERIFIED |
| ST-07 | A destructive action, global install, push, tag, publish or PR that the user did not ask for |
| ST-08 | A fix that weakened accessibility, security, locks or the untrusted-data stance |
| ST-09 | A flaky security or concurrency test that was quarantined or retried |
| ST-10 | A new CI check that was never seen failing on a bad fixture |
| ST-11 | A session that started on a dirty tree without explanation |
| ST-12 | A session that ran on after a reset trigger, or a handoff written from memory when the files disagreed |
| ST-13 | An agent that followed a user instruction against a rule without offering a safe alternative |
| ST-14 | A dependency added without verification or with an incompatible license |
| ST-15 | A golden, threshold, tolerance or budget changed without a ruling |
## 9. Rules Audit

### 9.1 Part A (R-B): how each rule is verified

Result for each rule at a gate: **Held**, **Violated** (with finding IDs), **Not tested** (when the rule is convention only and no evidence was looked at).

| Rule | Summary | How the reviewer verifies |
|------|---------|---------------------------|
| R-B01 | Docs are the spec | RV-07 on sampled behaviors |
| R-B02 | Phase 0: one doc at a time, no code before 13 docs | Git log: no code before the last doc |
| R-B03 | One milestone at a time, no half-built features | GR-11, stubs that look finished |
| R-B04 | Smallest verifiable step, one concern per commit | RV-08 |
| R-B05 | Loop, stop after three repeats | Ledgers, stop reports (section 8) |
| R-B06 | No scope creep | RV-01 |
| R-B07 | No version or format from memory | `docs/versions.md`, CK-GEN-09 |
| R-B08 | Nothing claimed that was not run | RV-03 |
| R-B09 | No invented URLs, versions, numbers | Spot-check references and numbers in reports |
| R-B10 | No hidden failure, no weakened test | RV-13, RV-10 |
| R-B11 | Strict TypeScript, no `any` | CI, RV-09 |
| R-B12 | Zod at every boundary | CK per area, tests with invalid input |
| R-B13 | Import boundaries | TC-CIC-01 |
| R-B14 | Pure packages | TC-CIC-03, TC-COR-19 |
| R-B15 | One write path | CK-COR-01 |
| R-B16 | Banned APIs, network allowlist | TC-CIC-02, TC-CIC-04, V10 |
| R-B17 | Typed errors | TC-MCP-02 |
| R-B18 | Determinism | TC-ENG-03, TC-LNT-05 |
| R-B19 | No dead code, TODOs name a plan item | TC-CIC-06 |
| R-B20 | Small functions and files | Judgment. Report files over 400 lines and functions over 50 lines without a reason |
| R-B21 | Cross-platform | CI results per OS |
| R-B22 | Accessible Studio chrome | TC-STU-05, 07 |
| R-B23 | No color-only status. Calm microcopy | CK-STU-06, CK-STU-08 |
| R-B24 | Tests first | R5 red check |
| R-B25 | No mocking the unit | CK-TST-04 |
| R-B26 | Flaky test is a bug | Quarantine list, GR-12 |
| R-B27 | Golden changes reviewed | CK-ENG-07, TC-CIC-11 |
| R-B28 | No secrets | TC-CIC-08, SEC-14 |
| R-B29 | Dependencies verified and pinned | CK-DEP |
| R-B30 | Never execute user code | TC-SCN-02 (M3), code reading |
| R-B31 | Stay inside the project, no sudo, no global installs | Command history in reports, CK-CLI-02 |
| R-B32 | Ask before renames, license, deletions, decision changes | Git log for such changes, matching rulings |
| R-B33 | No push, tag, publish or PR unless asked | GR-20, git log, remote refs the user allows |
| R-B34 | Conventional commits, no `--no-verify`, no force-push | TC-CIC-07, RV-08 |
| R-B35 | Generated agent files committed, drift test | TC-GEN-01 |
| R-B36 | Load only what the task needs | RV-04, RV-05 |
| R-B37 | Memory written at the end of a task | RV-12 |
| R-B38 | Docs change only by change-log entry, conflicts listed | RV-06, DR-05 |
| R-B39 | Task report format | RV-04 |
| R-B40 | The user's language in chat, English in code and docs | Report language, source files |
| R-B41 | Ask only when it changes architecture, behavior or security | Stop reports and questions asked, at most 5 per round |
| R-B42 | Definition of done | RV-03, RV-04, RV-12 |

R-B33 and R-B31 cannot be proven from the repository alone. The reviewer states "not tested" unless the user gives access to the evidence (shell history, remote refs).

### 9.2 Part B, C, D

| Group | Rules | Verified by |
|-------|-------|-------------|
| Interview | R-R01 to R-R11 | Smoke lines 3 to 7 and 14, simulator TC-INT-18, CK-GEN-02. The reviewer notes that a scripted run cannot show a real agent follows R-R01 |
| Scene and tools | R-R12 to R-R22 | Smoke lines 8 and 11, TC-MCP, TC-COR, CK-GEN-02 |
| Locks | R-R23 | TC-COR-08, TC-MCP-11, smoke line 13 |
| Untrusted data and files | R-R24 to R-R27 | TC-MCP-10, smoke line 12, CK-GEN-10 |
| Studio and design | R-R28 to R-R36 | Smoke lines 9 and 10, TC-SRV-06, linter tests, TC-DOC-08 for claims (R-R35) |
## 10. Claims Review

### 10.1 Rule

A claim is allowed only if its evidence exists **in the same release**. The reviewer checks README, docs, release notes, CLI help, Studio strings, error messages and any agent-facing rule text. A claim without evidence is a Blocker if it states a result as fact (a number, "secure", "supported"), and a Major otherwise.

### 10.2 Claims table

| Claim | Allowed only when | Wording rule |
|-------|-------------------|--------------|
| "Install and run in under 5 minutes" | The stranger test measured it (test 8.3) | Replace by the **median and range with n**, or write "goal: 5 minutes (not yet measured)" |
| "97 to 99 percent match" or any match percentage | As "target", or as a measured value with its definition, denominator and sample (test 9.2). Initial match and final match are never merged `[dep: TS1]` | Never as an achieved result without a measurement. The agent never states it (R-R35) |
| "Supports Claude Code and Cursor" | A smoke record for the current release and agent version exists, with no unresolved Fail | Name the tested agent version and date |
| "Works with Cline, Codex, Windsurf, Copilot" | Never as tested | Only "best effort" (TC-DOC-08) |
| "Works on Windows, macOS, Linux" | The CI result for that OS, in this release | Otherwise "not tested on <OS>" |
| "Intent sends no data anywhere" or "your data never leaves your machine" | **Never allowed** (V8). The user's coding agent sends tool results, scene content, interview answers and feedback to its model provider, and Intent cannot control that | Use: "Intent itself makes no network requests (checked by SEC-13). Your coding agent may send scene and interview content to its own model provider." |
| "No telemetry" | SEC-13 passed in this release | Say "Intent has no telemetry" |
| "No API key needed" | True by design (PRD G3) | "Intent needs no API key. Your coding agent has its own account requirements" |
| "Secure", "safe", "protects against prompt injection" | **Never as an absolute** | State the controls and the tests: escaped text, sandboxed preview, closed grammars, loopback server with a token, and name the limits (rules 19, test 14) |
| "Accessible" or "WCAG compliant" | Only as: "automated checks (axe, linter) pass, manual keyboard and screen-reader pass recorded on <date>" | "WCAG compliant" only after an audit |
| "Deterministic export" | TC-ENG-03 passes | Keep to "same scene, same bytes" |
| "The export matches the Studio" | TC-VIS-01 passes | State the scope: Chromium, pinned Linux runner, system fonts |
| "Learns your preferences" (M3) | Profile tests pass and the user can view, edit and delete entries | Say it is local and how to turn it off |
| "Asks N questions" | Measured by the simulator or the trial | "About" with the measured range |
| "Open source, MIT" | LICENSE file present and audit shows compatible licenses | Plain statement |
| "Production-ready", "ultra", "smartest", "best" | **Never** | Remove |

### 10.3 Checks the reviewer runs
## 11. Security-Focused Review (kind F)

| ID | Check |
|----|-------|
| SX-01 | The change is compared with the threat model (architecture 12). A new input surface (route, tool input, file read, message) is validated by Zod at the boundary |
| SX-02 | Every new file path goes through `FileAdapter`. Symlinks are refused `[dep: TS4]`. IDs match the regex before they touch a path |
| SX-03 | No new request path skips the cookie, Host and Origin checks. No CORS headers appear |
| SX-04 | Tokens, cookies and URLs with tokens never appear in logs, errors, files, handoffs, tests or fixtures |
| SX-05 | Any CSP, sandbox attribute or header change has a ruling and a test that the old attack still fails |
| SX-06 | **Process spawn:** the Studio server spawn in `open_studio` uses a fixed executable and a fixed argument list, **no shell** (`shell: true` is a finding), no user text in arguments, a controlled environment, and detaches as documented. Any other `child_process` use outside the testkit is a finding `[dep: V10]` |
| SX-07 | Regular expressions applied to untrusted input have no nested quantifiers and were tested with long inputs |
| SX-08 | New text output (HTML, CSS, JSON, Markdown, rule files) escapes or validates its inputs. Closed grammars are not widened |
| SX-09 | Untrusted-data handling: scene, feedback and answer text stay inside data fields and never become instructions (R-R24) |
| SX-10 | Logs hold IDs and rule names only, never scene or feedback text |
| SX-11 | No new network capability, no remote resource, no telemetry. SEC-13 still passes, with its bad fixture |
| SX-12 | Dependencies added by the change were checked for install scripts, maintenance and license (CK-DEP) |
| SX-13 | Failure modes fail closed: a bad token, a bad header, a corrupt file or a lock error refuses the action |
| SX-14 | Attack-case tests exist for each guard, and R6 (spot mutation) showed they fail when the guard is removed |

Limit: a security-focused review by the same kind of model as the author is a second look, not an audit. See section 16.

## 12. Release Review (kind D)

| ID | Check |
|----|-------|
| RE-01 | The gate review for this milestone has a Pass or Pass with conditions, and every condition is met |
| RE-02 | The version follows semantic versioning. A new `schemaVersion` is at least a minor bump (trd 19) |
| RE-03 | The package contents were inspected (a dry-run listing of what would be published): only intended files, no tests, no `.intent/` data, no secrets, no tokens, no local paths |
| RE-04 | `LICENSE` is present. The audit shows compatible licenses |
| RE-05 | A clean-machine install from a local tarball ran the headless flow (TC-E2E-05) on each CI operating system |
| RE-06 | Generated files are fresh (drift) and the README shows the tested agent versions and dates |
| RE-07 | The claims review (section 10) passed on README, release notes and CLI help |
| RE-08 | Facts older than 90 days (`docs/versions.md`, calibration, smoke) were re-checked |
## 13. Findings

### 13.1 Severity

| Severity | Meaning | Examples | Must be |
|----------|---------|----------|---------|
| **Blocker** | Harm, data loss, security hole, a false claim, or a break of an **unwaivable** rule (R-B28, R-B30, R-R23, R-R24, R-R33) | A lock bypass, unescaped scene text in export, a weakened test, a stated result without a measurement, a step marked CI-confirmed with no CI evidence | Fixed before approval. No waiver for the unwaivable rules |
| **Major** | A rule or spec is broken, or a guard is untested, with a bounded effect | A missing attack test, a doc and code disagreement, a threshold changed with no ruling | Fixed before approval, or waived by the user with a record (R-G01) |
| **Minor** | Quality or clarity problem with no effect on behavior | A long function, a vague test name | Fixed now, or logged as a plan.md item |
| **Note** | Observation or praise-worthy pattern | A suggestion for a later step | May go to memory as a lesson |

When unsure between two severities, choose the higher and say why (RP-07 still applies: harm decides).

### 13.2 Verdicts

| Verdict | Meaning |
|---------|---------|
| Approve | No Blocker, Major or Minor open |
| Approve with notes | No Blocker or Major open. Minor and Note items listed |
| Changes requested | At least one Major open, and no Blocker |
| Blocked | A Blocker, or a stop trigger fired, or the change is too big to review (RP-06) |

A verdict is a recommendation. The user merges, waives and decides.

### 13.3 Finding format

```
F-<n> [Blocker|Major|Minor|Note]  <area>  <file:line | doc section>
Rule/Spec:  <rule or spec ID(s)>                         Rule: <R-xx>   (one rule ID for counting, V9)
Evidence:   <command and result, or location; never copied doc text>
Why:        <the harm, in one or two lines>
Fix check:  <how to verify the fix: test ID, command, or reading>
Status:     open | fixed (commit) | disputed | waived (WV-n) | deferred (plan item) | withdrawn
```

### 13.4 Lifecycle and disputes

1. The author answers each finding: fix, rebut with evidence, or ask for a waiver or a deferral.
2. A rebuttal needs evidence (a test, a doc section, a command). "I disagree" is not enough. The reviewer may withdraw a finding.
3. An unresolved dispute goes to the user, with both positions in two lines each. The user decides, and the decision is recorded as an MD entry.
4. **Deferred** needs a plan item and is allowed only for Minor and Note.
5. Re-review (R10) checks the changed lines and the finding's fix check, nothing more, unless a new risk appeared.
6. A finding is closed only when its fix check passes in the reviewer's run.

## 14. Report Templates

### 14.1 Change or document review

```
REVIEW <date> <step id or doc> <task name>
Kind: A|B   Level: L2   Risk: high|normal   Reviewer: <agent and version | person>
Context loaded: <pack and sections>        Not loaded: <omissions>
Scope:     commits <range>, files <count>, areas <list>
Ran:       <rung or command> -> <result> (one line each)   Red check: <n tests failed as expected, n did not>
           Spot mutations: <guard> -> <test that failed | none failed>
Findings:  Blocker <n>  Major <n>  Minor <n>  Note <n>
F-1 ...
Verdict:   Approve | Approve with notes | Changes requested | Blocked
Not reviewed: <list>
Next step: <author fixes F-x, re-review of changed lines, then the user decides>
```

### 14.2 Gate review

```
GATE REVIEW <milestone> <date>   Reviewer: <agent and version | person>   Level: L2
Scope:       commits <range>, steps <list>, doc versions <list>
Recommendation: Pass | Pass with conditions | Fail | Not decidable
Counts:      Blocker <n>  Major <n>  Minor <n>  Note <n>
GR table:    GR-01 .. GR-20 : Met | Not met | Not applicable yet (<dep>) | Not run : evidence
Pending amendments older than the milestone: <computed count>, ids <list>
UNVERIFIED rows: <list with dates>        Waivers: <list>
## 15. Review Metrics and Drills

Recorded in each gate report and summed for planned versus actual (PL-11).

| Metric | Meaning |
|--------|---------|
| Findings by severity and area | Where defects cluster |
| Findings by rule ID | Input to section 9.3 |
| Escapes | Defects found after a review said Approve. Each gets a lesson naming the check that would have caught it |
| Red-check failures | New tests that did not fail on the parent. A high rate means tests are written after the code |
| Spot-mutation survivors | Guards that no test caught |
| Re-review rounds per change | Many rounds point to a spec or size problem |
| CI lag | Reported from loop.md |

**Review drill (optional, user-run).** At each gate the user may plant one known defect in a throwaway branch (for example, remove a lock check or an escape) and have a fresh reviewer review the branch without being told. Whether it is caught is recorded as a verified fact. This is the only direct measure of review quality. A missed defect is a finding against the process, not against a person.

## 16. Honest Limits

1. **An agent reviewer shares the author's blind spots.** A fresh session removes memory of authoring but not the model's habits. Using a different agent or vendor helps (VQ1). It does not remove the problem.
2. **This is not a security audit.** Kind F is a structured second look. An independent human security review before v1.0.0 is recommended (test TQ12) and is the user's decision.
3. **A reviewer sees only the diff and the pack.** A missing test or a wrong requirement is visible only if the reviewer checks the spec. Reviews catch defects in what was written, not whether the requirement was right.
## 17. Conflicts, Amendments and Flags

Nothing in earlier documents has been changed silently. Each item needs the user's ruling, then a dated change-log entry in the affected document.

| ID | Conflict or amendment | Affects | Rec |
|----|----------------------|---------|-----|
| V1 | **Who reviews and how independent.** rules R-B42 defines a done task without any review. plan S-1-15 and the gate say "the review was done (review.md)" without saying by whom. A self-review has blind spots (loop 14.6). Proposal: three levels (2.3). L2, an independent fresh-session review, is required for **high-risk** changes (2.1) and for every gate. Normal-risk changes rely on L1 and CI, and are covered at the gate. At v1.0.0 an independent human security review is recommended. **Options:** (A) recommended: L2 for high-risk changes and gates. (B) L2 at gates only. (C) The user reviews everything | rules R-B42, plan S-1-15, context CX-17 | **decide** |
| V2 | **Reviewer write scope and report storage.** context CX-17 says helper sessions are read-only and never write docs. A reviewer must write its report. Proposal: the reviewer writes only its review report, in chat or in `docs/reviews/` as in 14.3, never code, tests or docs. Add `docs/reviews/` to the repo layout as an on-demand (L2) location | context CX-17, architecture repo layout | accept |
| V3 | **Guarded files have no CI check.** test.md TC-CIC-11 detects golden changes only. Thresholds, budgets, coverage gates and the rule maps rely on convention (TP-11, ST-15). Proposal: a list of guarded files (`tests/visual/threshold.json`, `tests/perf/baseline.json`, `tests/fixtures/rules-since.json`, `tests/fixtures/rules-tests.json`, coverage and lint configuration, the budget constants used by `context:check`, CI workflow files). New check **TC-CIC-13**: a change to a guarded file fails CI unless a commit trailer `Ruling: MD-<n>` names an Accepted decision. It needs a bad fixture (TP-02) | test 4.5 and 7.5, TP-11, loop ST-15 | accept |
| V4 | **Claims are only partly checked.** TC-DOC-08 covers agent-support claims. Proposal: extend it into a claims lint over README, CLI help, Studio strings and error messages, using a small phrase list in `tests/fixtures/claims.json` (percent near "match" without "target" or "measured"; "minutes" without "median"; "secure", "safe", "guarantee", "production-ready"; "never leaves"). It has a bad fixture. False positives are handled by editing the list with a ruling | test TC-DOC-08, PRD G7 | accept |
| V5 | **memory.md is append-only by rule only.** MR-04 forbids editing history, and nothing checks it. Proposal: **TC-DOC-10**: a diff-based check on memory.md sections 4, 5 and 8 that fails if an existing line is removed or changed, except status cells and the `Superseded by` marker. It has a bad fixture | memory MR-04, test TC-DOC | accept |
| V6 | **S-1-15 is too small for a gate review.** plan lists S-1-15 as size S, delivering the review, the gate checklist, the planned-versus-actual record and a release candidate. Section 7 has 20 items plus the audits. Proposal: split it into **S-1-15a** (independent gate review, fresh session, size M, depends on S-1-14) and **S-1-15b** (gate decisions, planned versus actual, release candidate, size S, depends on S-1-15a). The same split applies to the M2 and M3 gates | plan 8.3, 9, 10 | accept |
| V7 | **The T-REVIEW pack points at a whole file.** context 3 and 5.3 say "review.md (the matching checklist)". This doc is large. Proposal: T-REVIEW loads review.md sections 2, 3, 4 and 13, plus the one section for the change (5.x, 6, 7, 11 or 12). Update context 5.3 and the doc map in context 3 | context 3, 5.3 | accept |
| V8 | **"Local-first, no telemetry" can be read as "nothing leaves your machine".** PRD NFR-1 and architecture 19 describe local-first operation. Intent itself makes no network request, but the user's coding agent sends tool results, scene content, interview answers and feedback to its model provider. A README that implies otherwise would mislead users. Proposal: add one sentence to PRD NFR-1, architecture 19 and the README: "Intent makes no network requests. Your coding agent may send scene and interview content to its own model provider." The claims table (10.2) already follows this | PRD NFR-1, architecture 19, README | accept |
| V9 | **R-G05 cannot be counted.** rules R-G05 makes rules broken twice a candidate for stronger enforcement, and no record names the rule. Proposal: every finding, every stop report's trigger line and every lesson names a `Rule:` ID. Add a `Rules:` column to the lesson table (memory 8) and the field to the stop report (loop 8.2) | rules R-G05, memory 8, loop 8.2 | accept |
| V10 | **Process spawn is not covered by banned APIs.** `open_studio` spawns a detached child process (trd 10.8). R-B16 and trd 22.6 ban `eval` and similar sinks but say nothing of `child_process` or `shell: true`. Proposal: add to R-B16 and trd 22.6 that `child_process` is allowed only in the Studio spawn module and the testkit, with fixed arguments and no shell, and that `shell: true` is banned. Add a CI check and a bad fixture to TC-CIC-02 | rules R-B16, trd 22.6, trd 10.8, test TC-CIC-02 | accept |
Ruling order that avoids rework: V1 first (it changes plan S-1-15, V2 and V6), then V8 (wording that must be right before the README is written), then the other accept items in one batch.

Memory's Pending total after this document is computed from the register. The agent adds V1 to V12 and verifies the total (memory M5). By my count the earlier 87 becomes 99, but the agent must recompute it.

## 18. Open Questions

- VQ1. May the reviewer use a different agent or vendor than the author? It improves independence and costs more. User decision with V1.
- VQ2. Are `docs/reviews/` files committed or kept local? Proposal: committed (evidence for the gate). User decision with V2.
- VQ3. Which method makes the red check and the spot mutation work the same on Linux, macOS and Windows (temporary worktree paths, line endings)? Verify at S-0-02.
- VQ4. Is a small helper script for the red check worth building, or does the reviewer do it by hand each time? Parking-lot candidate (ID assigned at Step R).
- VQ5. Who performs the external human security review, when, and at whose cost (test TQ12)? User.
- VQ6. How many past reviews should a gate re-check as a calibration sample (default 2)? Tune after M1.
- VQ7. Whether the Tier 1 agents allow a read-only mode that can be enforced (instead of by instruction). Verify at S-0-01.

## 19. Flags for Later Documents

- **pr.md (doc 13):** the PR template carries: step ID, acceptance criteria, risk tier, review level and verdict, test IDs added or changed, guarded files touched with their `Ruling:` ID `[dep: V3]`, claims touched, amendments and waivers touched, seed IDs for bank changes, the ledger summary, and the Done (local) or Done (CI-confirmed) status.
- **memory.md:** register V1 to V12 (all Pending). Add the `Rules:` field to the lesson format (V9). Record review drills as verified facts.
- **context.md:** T-REVIEW pack sections (V7). `docs/reviews/` as an on-demand location (V2). Reviewers carry the "blind first" order in their pack description.
- **plan.md:** split S-1-15 (V6). Add the review sessions to the size guesses (PL-02). Add VQ3 and VQ7 to S-0-01 and S-0-02 verification.
- **test.md:** TC-CIC-13 (V3), the claims lint (V4), TC-DOC-10 (V5), and **TC-DOC-11**: every rule ID R-B01 to R-B42 and every stop trigger ST-01 to ST-16 appears exactly once in the audit tables of this doc. Add a bad fixture for each.
- **loop.md:** the stop report gains a `Rule:` line (V9). The handoff's loop stats feed GR-10.
- **rules.md:** R-B42 gains the review requirement from V1 once ruled. R-B16 gains the spawn rule (V10). R-G05 gains the counting method (V9).
- **trd.md and architecture.md:** V8 (privacy wording) and V10 (spawn).

## 20. Change Log

- 2026-10-29: v0.1
- 2026-10-30: v0.2 — Reconciliation Pass (Step R) applied. Owner accepted all recommendations. Dated change-log entry added per MR-03. created from prd.md, design.md, architecture.md, trd.md, rules.md, context.md, memory.md, intent.md, plan.md, test.md and loop.md v0.1. Proposes V1 to V12. Resolves the review-related flags of rules, context, intent, memory, plan, test and loop.
| V11 | **SR items are included by reference.** loop L8 said review.md must include SR-01 to SR-11 and may extend them. RV-02 includes them by reference, so there is one source. If loop.md section 12 changes, this doc follows without a second edit | loop L8, section 12 | info |
| V12 | **Checklist items that depend on Pending amendments.** Several items cite amendments that are still Pending (for example C-X7, L4, L7, L9, TS1, TS4, P7, P10, C2, V3). Convention: such items are tagged `[dep: ID]`, apply only when the amendment is Applied, and are reported "not applicable yet" until then | this doc | info |
4. **Checklists invite box-ticking.** The checklist is a floor. The reviewer must read the code, especially in high-risk files.
5. **Some rules are judgment** (R-B04, R-B20, R-B36). The audit reports them as observed, not proven.
6. **CI-only evidence cannot come from the reviewer.** Items that need other operating systems or scheduled runs stay "awaiting CI" until real records exist (loop L4).
7. **Smoke and claims age.** A record names an agent version and date. It says nothing about newer versions.
8. **Review cost is real.** L2 on every high-risk change costs sessions. V1 lets the user choose the balance.
Stops by trigger: ST-02 x<n>, ...         Open lesson stubs: <none | list>
Rules with two or more violations: <table>      Proposals under R-G03: <list>
Claims review: <findings>                Security (SEC, kind F): <summary>
Planned versus actual: <table>
Not reviewed: <list>
Conditions for Pass: <list with owners>
Decision: the user (PL-10, R-B33)
```

### 14.3 Where reports go (proposal V2)

| Review | Location |
|--------|----------|
| Kind A or B with verdict Approve or Approve with notes | In chat and in the PR description and handoff. No file |
| Kind A or B with a Blocker or Major finding | `docs/reviews/<date>-<step or doc>.md` |
| Kind C and D | `docs/reviews/gate-<milestone>-<date>.md`, `docs/reviews/release-<version>-<date>.md` |

Reports are committed, because they are evidence for the gate. They contain no secrets, no tokens and no real data. A report is at most 150 lines. `docs/reviews/` is read on demand (L2) and is never part of L0.
| RE-09 | The changelog lists breaking changes and migrations. The engine and Node support range matches `doctor` |
| RE-10 | The agent **prepared** the release and **did not** tag, push or publish. The user does that (PL-10) |
| RE-11 | Known limits and open Pending items are listed in the release notes in plain words |
| RE-12 | `npm` name availability and ownership were verified (VF-010) before the first publish |

1. Search the changed text for percentages, "minutes", "secure", "safe", "guarantee", "compliant", "supported", "production" and "never leaves".
2. For each hit, find the evidence row. If none, finding.
3. Check that the README's agent list matches the smoke records (TC-DOC-08) and that "Tier 2" appears only with "best effort".
4. Check that the Studio and CLI strings do not state certainty the meter does not have (the label "Estimated understanding" stays, design 2.2).
5. A claims lint for these phrases is proposed in V4.
| Authoring | R-C01 to R-C07 | TC-GEN-02, 03, 08, 09, CK-GEN-04, 05 |
| Governance | R-G01 to R-G05 | GR-07, GR-08, CK-GEN-11 |

### 9.3 Rules broken twice (R-G05)

1. The reviewer builds a table from findings, stop reports, ledgers and lessons: **rule ID, count, steps, how it was caught**. Counting uses the `Rule:` field (V9).
2. A rule with two or more separate violations is a **candidate**. The reviewer proposes a stronger mechanism using the enforcement codes of rules section 1 (C to CI or T or S), or a change to the rule's wording, following R-G03: the real failure, the proposed rule, how it is enforced.
3. The user rules. The reviewer never changes a rule (R-G02).
| ST-16 | A task that mixed two packs, with changes from both in one commit |

For each trigger the report gives: count, steps involved, whether the stop report exists, whether a lesson was written and completed.
| Any Blocker open | Fail |
| No Blocker, any Major open without a waiver | Pass with conditions (list them, each with an owner) |
| No Blocker, no Major open, Minor and Note only | Pass |
| A required check is "Not run" | Not decidable. State why. A "Not run" is never counted as Met |

### 7.1 Procedure

1. A fresh session (L2) performs it, using the T-REVIEW pack and the sections named here. It runs the checks. It does not copy results from earlier reports.
2. It writes the gate report (14.2) to `docs/reviews/` (V2).
3. It **recommends**. The user decides about the tag and any publishing (PL-10, R-B33).
4. Any Blocker means the recommendation is Fail. Any Major without a waiver means Pass with conditions at best.
| CK-TST-05 | A deleted or skipped test has a ruling. A quarantine tag has a plan item. At most 3 quarantined, none for security or concurrency, none older than one milestone | test 12 |
| CK-TST-06 | A golden or threshold change meets CK-ENG-07 and RV-10 | RV-10 |

### 5.16 Scanner (M3)

| ID | Check | Verified by |
|----|-------|-------------|
| CK-SCN-01 | User code is never executed. Configs are parsed statically | TC-SCN-02 |
| CK-SCN-02 | Only allowlisted files are read, `.gitignore` is honored, large files are skipped | TC-SCN-03 |
| CK-SCN-03 | Output is deterministic and sorted. Unknown formats are ignored, not guessed | TC-SCN-04 |
| CK-SCN-04 | A profile that fails contrast does not relax any rule | TC-SCN-05 |
| CK-BNK-13 | Bank equals doc: IDs, slots, tiers, `since`, option IDs. Counts are 35, 6 and 5 | TC-INT-01, 02 |
| CK-BNK-14 | Every non-control seed has a default with a rule, or `not-delegable` (only `goal.purpose`). Defaults never lower accessibility | DP-1 to DP-6 |
| CK-BNK-15 | `profileKey` is in the closed list. Deep-dive seeds do not enter the meter. Control seeds are not counted | TC-INT-01, 07 |
| CK-BNK-16 | The PR lists every changed seed ID and the matching intent.md section | intent 19 |
| CK-BNK-17 | A translated or rewritten seed keeps its option IDs | intent 6.2 |
| ID | Check | Verified by |
|----|-------|-------------|
| CK-LNT-01 | The rule has a passing and a failing fixture | TC-LNT |
| CK-LNT-02 | A rule emits `error` only when certain. Estimates give `warn` with `confidence: "estimated"` | TC-LNT-06 |
| CK-LNT-03 | Output is deterministic and sorted | TC-LNT-05 |
| CK-LNT-04 | Accessibility rules cannot be disabled or downgraded by config | TC-LNT-07 |
| CK-LNT-05 | Fix hints exist and suggested values are valid and deterministic | TC-LNT-10 |
| CK-LNT-06 | Rule IDs, thresholds and milestones equal design.md section 9 and trd 7 | Diff |
| CK-LNT-07 | No DOM or Node-only API. Same output in Node and in a browser page | TC-LNT-08 |
| CK-LNT-08 | The default token pairs still pass the new rule | TC-LNT-09 |
| CK-SCH-03 | A changed or new persisted field has a default or a migration. `schemaVersion` handling follows trd 19. A new version is at least a minor bump | TC-MIG fixtures |
| CK-SCH-04 | Limits equal trd 20, or a ruling is cited | Diff |
| CK-SCH-05 | ID prefixes and the regex are unchanged. No ID is built from user text | TC-SCH-04 |
| CK-SCH-06 | Canonical serialization is unchanged (key order from the schema, sorted records) | TC-SCH-05 |
| CK-SCH-07 | No Node import. No new dependency in `schema` | CI boundary check |
| CK-SCH-08 | Enum lists (error codes, ops, statuses, tool names) equal the docs | TC-DOC-06 |
### 3.2 Reviewer permissions

1. **Read-only on source, tests and docs.** The reviewer writes **one file only**: its review report, and only where section 14.3 says (V2).
2. May run any check from the ladder (loop.md section 5). Any temporary worktree lives inside the project directory (R-B31) and is removed afterwards.
3. Never commits, pushes, tags, opens a PR, edits a threshold, golden or doc, or "fixes while reading" (RP-08).
4. Never sets a status in memory.md (MR-03) and never grants a waiver (R-G01).

### 3.3 Reviewer context

Loaded (pack T-REVIEW, V7): this doc sections 2, 3, 4, 13, plus the one checklist section that matches the change (5.x, 6, 7, 11 or 12); rules Part A; the diff; the step's acceptance criteria in plan.md and test.md; the author's report and ledger.

**Blind first.** The reviewer reads the spec, the tests and the diff **before** the author's report and justification, forms its own view, and only then reads the report. This keeps the author's reasoning from steering the review.

### 3.4 Procedure (kind A)

| # | Step | Detail |
|---|------|--------|
| R1 | Orient | Say: Task / Pack / Loaded / Not loaded (CX-06). State the review level and the risk tier |
| R2 | Scope | Read the step's acceptance criteria. List changed files and group them by area. If the diff is larger than one session can review, request a split (RP-06) and stop |
| R3 | Spec | Read only the spec sections the pack names for the area |
| R4 | Tests first | Read new and changed tests. For each, ask: what behavior, what attack case, could it fail, does the name match the behavior |
| R5 | Red check | Run the new tests against the parent commit's source. They must fail for the intended reason (SR-02). A test that passes without the change is a finding |
| R6 | Spot mutation | For each new security, lock, escaping or limit guard, break that guard locally in a temporary worktree and confirm a test fails. If none fails, the guard is untested (finding). Remove the worktree |
| R7 | Code | Read the implementation against the checklist (4 and 5.x). Read every changed line of high-risk files |
| R8 | Re-run | Run the ladder rungs that apply (loop.md 5.1) in a clean checkout. Compare with the author's report. A difference is a finding |
| R9 | Report | Read the author's report and ledger (RV-03, RV-04). Write findings and the verdict (14.1) |
| R10 | Close | After the author's fixes, re-review **only** the changed lines and the findings. Re-run the affected rungs. Update each finding's status |

Red check detail: take the test files from the change, place them over the parent commit in a temporary worktree, run them, and expect failure. Use any method that works on Windows paths too (VQ3).