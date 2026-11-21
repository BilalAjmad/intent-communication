# Human Trial Protocol (for later, real people)

This is the real-people version of the agent-driven trial above. Run it when a
human panel is available. Nothing here has been run yet.

## Setup
- 8-12 participants matching the persona sheets in `personas.md` (one per sheet).
- Each participant does 2 tasks (T1 + one of T2/T3), order balanced across arms.
- Arm A: one-shot prompt to the agent, no Intent. Arm B: `/intent` then `/prototype`.
- Record: questions asked, minutes, send cycles, initial match, final match.

## Scoring
- Initial match (trd 17.2): objects accepted unchanged on the first render.
- Final match: items of the hidden sheet satisfied in the exported scene
  (denominator shown). Automated where possible; manual checklist otherwise.
- Report medians + min + max per arm in `results-<date>.md` and README.
- Label: "human trial, n=<N>, <date>". Never "100%".

## Ethics
- No PII stored; participant IDs are P1..PN.
- Consent obtained before recording.
- Results reported with denominators and sample size.
