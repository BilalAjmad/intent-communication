p = r"H:\intent communication\tests\smoke\CHECKLIST.md"
s = open(p, encoding="utf-8", errors="replace").read()
note = "\n## Live session evidence (2026-11-21, Kilo Code 7.8.31)\n\n"
note += "- Transcript: kilo run session (headless). Evidence files: tests/smoke/2026-11-21/kilo-interview-state.json, tests/smoke/2026-11-21/kilo-salon-booking.html\n"
note += "- Row 3 (agent starts interview without mentioning Intent): Pass - Kilo read .intent/rules/intent-core.md and started ask_user interview on \"Design a salon booking app\"\n"
note += "- Row 8 (Exactly right -> brief saved): Fail - agent declared Approved but did not call ask_user with summaryChoice exactly-right; interview state remained in_progress, briefId null. Agent compliance issue, not a product bug (MCP tools verified by unit tests).\n"
note += "- Row 17 (interview-only, no building): Fail - agent built salon-booking.html directly without Intent scene population; noted apply_patch cannot create new top-level screens in M1.\n"
note += "- Non-blocking rows (8, 17) documented as agent-compliance findings, not product bugs.\n"
note += "- Blocking rows (3,4,9,11,12,13): Row 3 Pass; rows 4,9,11,12,13 not exercised in this session (no Studio feedback, no lock test, no prompt-injection test).\n"
marker = "\n## HUMAN GATE 1"
if marker in s:
    s = s.replace(marker, note + marker, 1)
open(p, "w", encoding="utf-8").write(s)
print("done")
