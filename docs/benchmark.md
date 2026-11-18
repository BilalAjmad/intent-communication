# Synthetic Intent-Match Benchmark (what it is and, honestly, what it is not)

**Not a human trial.** This benchmark is a scripted persona driving the real
interview and the real tools; no human answers it. It exists to catch
regressions in the interview → build → lint → export foundation and to give
CI a machine-checkable answer to the question "does the loop still hold?".

It is NOT a measurement of the 97–99% "intent match" target. That number can
only come from a human panel (P8 — see `acceptance-protocol.md`), and it is
not, and cannot be, produced by this file.

## What it checks (per task, 6 machine-checkable requirements)

1. Interview completed (`status: "complete"` after a summary `exactly-right` answer)
2. Exported HTML contains the CSP meta tag
3. Task-specific export content (salon name present / Pro plan price present)
4. The export contains the primary CTA label the persona demanded
5. The export contains the hero copy the persona demanded
6. Zero error-severity lint violations, checked through the real `validate` MCP tool

## Tasks

- **Task A — salon booking app** ("booking app for my salon")
- **Task B — SaaS pricing page** ("pricing page for a project tracker")

## How to run

```bash
pnpm --filter @intent/cli exec vitest run src/intent-match-benchmark.test.ts
```

Or just run `pnpm verify` — it is part of the unit suite (`packages/cli`).

## What a pass means

A pass means: given a deterministic persona, the interview completes, the
agent can patch the scene, the linter finds no errors, and the export is a
valid HTML file containing the demanded content. It proves the *foundation*
holds.

A pass does NOT mean: a real merchant would sign the result off. That is the
only question the 97% target asks, and only a human can answer it.

## What would make this benchmark meaningful

A set of recorded real sessions (intent + what the user accepted or changed
afterwards). That is a human protocol, not a script. See
`acceptance-protocol.md` for the P8 harness.
