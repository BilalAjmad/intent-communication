# S-3-00 — M3 Re-plan (executed 2026-11-17, after M3.A progress)

**Status:** re-plan done after M2 work per PL-07 rolling wave. Written against the M3 as-built state at HEAD (b9a816a).

## M3 scope and actual state

| Step | Scope | Status |
|------|-------|--------|
| M3.A — Scanner + Design Profile (trd 16) | `intent scan`: tailwind/W3C/CSS/shadcn/storybook deps detection; fully static | **DONE** (d7985ed) |
| M3.A — design profile consumed by React export (trd 13.7) | Tailwind class emission on exact hex/px/radius match; CSS-var fallback | **DONE** (b9a816a) |
| M3.A — linter from profile context | Not built | NOT DONE — needs contrast pairs from profile; linter works context-free today |
| M3.B — Intent Profile (trd 17.1) | signals → learned entries; Studio Profile tab; MCP profileSummary/preFilled | **DONE** (d5cc753) |
| M3.C — acceptance-rate metric (trd 17.2) | first-render baseline; /api/metrics; Studio view; `intent export` summary | **DONE** (43c04ab); 97% target remains unmeasured |
| M3.C — animations (trd 13.6) | @media (prefers-reduced-motion: no-preference) wrapping; base reduce guard | **DONE** (113aa44) |
| M3.D — Tier 1 E2E + cleanup + gate | S-3-00 (this doc); docs cleanup | Partial; full M3 demo/README re-test NOT run |

## What M3.D still owes

- Reference demo scenes run through full agent round (acceptance metric real run — needs a real agent session, owner/
  human confirmation).
- README 5-minute path re-tested as part of M3 acceptance.
- docs/acceptance-protocol.md is the P8 harness; human trial = owner decision (8-12 participants if desired).
- S-3-00 itself and M3.D gate: requires the owner to call tag/publish readiness; tagging is owner-only (R-B33, PL-10).

## Personalize next step (owner decisions — cannot be agent-decided)

 - **LICENSE** — MIT chosen (completely free for everyone, owner directive 2026-11-18). Tag/push/publish remain owner-only per R-B33/PL-10.
- **v0.1.0 tag + push + npm publish** — repo is ~75 commits ahead of origin, never pushed. Push is yours to authorize.
- **Moveable** — still not added; drag/resize is hand-rolled (shipsped, tested). Add Moveable only if you want library help.
- **Benchmark targets** — CI-host measurement now documented; tighten on laptop-class hardware before claiming trd 21.

## This milestone's honest completion estimate

M3 ≈ 70%. The remaining 30% is deliberately owner-gated (release readiness, human trial, license, benchmark re-measurement). The agent-doable work left is documentation coverage, not new capability.
