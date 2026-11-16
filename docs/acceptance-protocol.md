# Acceptance-Rate Validation Protocol (P8) — trd 17.2 in action

**Status:** reference scenes and harness defined. Human trial: **NOT RUN — owner-blocked**. This document exists so the 97% target is never quoted as a result.

## What the metric measures (trd 17.2)

`acceptanceRate = (baseline objects still present and never touched by an applied patch) / (baseline objects still present)`

Baseline = the scene at the **first-render** marker (first successful `apply_patch`), or `available: false` with a reason. Removed baseline objects leave the denominator (conservative). Added objects are reported separately and never count as accepted. Patches without a parseable `appliedAt` are excluded (conservative).

## Where it surfaces

- `intent export` — one-line summary, console only (export output metadata, never embedded in the artifact).
- Studio → Inspector → **Acceptance** — live, re-fetched on SSE `revision`.
- `GET /api/metrics?sceneId=` — session-authed JSON.

## Reference demo scenes (scripted; for pipeline validation only)

Five scenes, each a text-only `intent export --format html` after a real edit→feedback→agent-patch→apply round:

1. **Checklist (content-heavy)** — 40 text objects; engine round-trip, then 3 targeted patches. Expect ≥ 35/40 accepted unchanged.
2. **Signup form (density preference)** — inputs + labels; one patch changes button copy. Expect: button changed, inputs accepted.
3. **Empty dashboard (layout)** — containers only; one responsive override patch. Expect: containers accepted, patched one changed.
4. **Article (tone)** — long copy; two small patches (one rejected by lint, one applied). Expect: acceptance counts only the applied one; rejected does NOT lower the denominator (rejected patches are not applied patches).
5. **Wind theme (palette)** — colored surfaces; one token change. Expect: palette-affected objects changed, everything else accepted.

These runs prove mechanics (locking, revision, metric math) — NOT user intent match. Any number from them is a self-test, never a product claim.

## Honesty rules (binding)

- Report only measured numbers, labeled with the fixture or the real session count.
- Never quote 97% (PRD §9 target) as a result. If the measured number is below target, report it below target.
- The human trial — N real people completing real tasks, or it does not exist — requires: real users, real agents, real consent. **Owner decision; never agent-run.**

## What is done now (2026-11-17)

- Metric engine + first-render baseline: unit-tested (branch coverage: empty baseline, all removed, no patches, all changed, pre-baseline exclusion, unknown-objectId exclusion, corrupt baseline → unavailable).
- Server API: session-authed; integration tests for no-baseline, ok, exclusion semantics, corrupt baseline, 403.
- Studio view: Playwright-tested (renders %, renders honest empty state).
- `intent export`: prints summary; tested via CLI build.

## Human trial (owner-blocked; DO NOT run or simulate)

Needed: 8–12 non-expert participants, 2 tasks each ("make the signup tighter", "swap the tone to professional"), any tier-1 agent the owner names, feedback→apply rounds logged, acceptance rate + time recorded per task, and a written debrief. The owner (or hired help) schedules it. This document is the script; running it is not the agent's to do.
