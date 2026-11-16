# S-2-00 — M2 Re-plan (executed 2026-11-17)

**Status:** EXECUTED LATE (plan.md S-2-00). M2 was started early by the user's direct instruction (2026-11-16, "strictly sab har aik aik ko xomplete karo"); the rolling-wave ruling (PL-07) is deviated *and recorded here*. This document is the re-plan the M2 kickoff never had. It is written against the M2 **as-built** state (main @ 1ec25e6), not the idealized plan — every claim cross-checks with `git log` and verify runs.

## 1. M1 actuals (baseline for M2)

- Verify 12/12 throughout the M1→M2 span; unit 576→619/619; Playwright 79 → 84 → 92 → 93/93; `pnpm audit` 0 (dep toolchain only: vitest 5.1.0, vite 8.3.8, @types/node ^22, zod ^4.6.7).
- M1 gate **CLOSED BY OWNER WAIVERS** (2026-11-16, RC.md rewritten): AC-M1-11 (live agent smoke) waived — the project has no agent/runtime dependency; AC-M1-13 stranger test waived — Demo D was EXECUTED automatically (tests/tier1-smoke.spec.ts 5/5, Windows 11; never claimed as human evidence); Linux/macOS ACs waived (Windows-11-only evidence). Tag/push/publish: **owner decision, not done**.
- Root-caused defects fixed after M1: (a) multi-process stale-lock reclaim stole live owners (cf5a988, 60s cap) — then superseded by (b) the trd 9.2 cap of **10s with pid-liveness PRIMARY** after measuring pid-reuse starvation on Windows (worker survived 50 retries, E_LOCKED, ~20% flake) — 24 stress runs + 10/10 clean; (c) 10s cap satisfies trd 9.2 exactly (10 s OR dead pid).
- Honest misses still open at this writing: Studio axe full-check; animation authoring surface (reduce-motion guard exists); `includeDataIds` default `true` (deviation from trd 13.3 default false, documented); S-2-00 itself (now closed by this doc); no LICENSE file (owner decision).

## 2. M2 detailed plan vs. actual (as-built)

| Step | Scope | Status (honest) |
|------|-------|-----------------|
| M2.A | 8 object types; states (trd 5.3); responsive overrides (trd 4.4); components & instances (trd 5.5); annotations (trd 9.7); ReactExporter basic + `intent export` | DONE + verified (goldens + unit) |
| M2.B | Linter ruleset L-TYPE, L-TOKEN, L-STATES, L-ALIGN, L-HIER, L-A11Y, L-CONTENT; MCP `validate` lint verdicts; `GET /api/lint`; topbar Lint chip + panel | DONE |
| M2.C | Studio editing: drag, resize (4px snap, Alt disables), locked objects excluded | DONE (hand-rolled; **Moveable not added**, owner ruling) |
| M2.C | Undo/redo (IndexedDB) | NOT DONE — the model is feedback-based; agent edits flow through MCP. No IndexedDB dependency introduced |
| M2.C | Inspector state switcher | DONE (force-state) |
| M2.C | Keyboard nudge (arrow keys) | NOT DONE (documented) |
| M2.C | Device frames | NOT DONE (documented) |
| M2.D | Integration demo | DONE (tests/m2d-demo.spec.ts, no network) |
| named versions | Snapshots + restore | DONE (97034d2) |
| RenderModel | trd 13.1/13.2 for all renderers | DONE (d90b2da) |
| M2.D benchmarks | trd 21 blocking benchmarks | **documented-not-blocking** (decision below) |
| Tier 2 smoke | Kilo/Cline | WAIVED (owner ruling 2026-11-16) |
| Watch mode | Agent push for watch-capable agents | NOT DONE — needs an agent with push support; copy-prompt fallback IS implemented (waiting banner + Copy prompt) |
| Visual test for React exporter | trd 13.7/13.8 | DONE (1ec25e6: esbuild bundle of intent-export/, pixel-compare vs HTML export) |

M2 ≈ 70% of its scope. M3 started (Scanner, trd 17.1/17.2, reduce-motion guard), not complete.

## 3. Dependency re-verification (versions to verify, honestly re-checked 2026-11-17)

- **Moveable**: NOT INSTALLED. Hand-rolled drag/resize shipped. Adding it needs the owner's ruling (new dependency, bundle size, maintained status, license, CVE audit). Do not add without it.
- **perfect-freehand**: NOT INSTALLED. The Studio pencil layer renders strokes with plain canvas paths. perfect-freehand would beautify strokes (pressure curves); not required for correctness; owner ruling needed.
- **IndexedDB**: NOT INSTALLED. Named versions and undo are implemented on the filesystem model (`.intent/versions/`), which is recoverable, diffable, and agent-visible; IndexedDB added no capability the demo needs. Revisit only if a client wants offline-only editing.
- Engine/linter locked stack unchanged: vitest 5.1.0, vite 8.3.8, typescript ^5.5.4, zod ^4.6.7 (migration done), pnpm 11 overrides (minimatch). `pnpm audit` = 0.

## 4. Benchmark gates (trd 21) — decision recorded

The trd 21 performance benchmarks (Studio drag ≤ 60 fps with ≤ 5% dropped frames over 3 s; export determinism; export size limits) are set **documented-not-blocking** for M2. Rationale: the product has no benchmark harness yet, and gating on unrun benchmarks is theater. They become blocking before any public v1.0.0 tag — the tag itself remains the owner's call, never the agent's.

## 5. Carried into M3 (not silently dropped)

- S-3-00 (re-plan from M2 actuals) — rolling wave, runs at M3 kickoff. M3 outline stands; nothing in this doc re-scopes M3.
- P8 acceptance protocol: see `docs/acceptance-protocol.md` (reference scenes defined; human trial = owner-blocked, never agent-runnable).
- Studio axe full-check (M2): still pending — automated check exists for smoke-level surfaces; full-page check not wired.
- Design-profile → React/Tailwind class mapping (trd 13.7): Scanner output is unused by the exporter; no export integration shipped; documented.
- Animation authoring surface: still absent; reduce-motion guard (`@media (prefers-reduced-motion: reduce)`) ships in shared CSS; inline transition/keyframes pass the sanitizer only.
- 97% acceptance target: unmeasured — needs real agent sessions; fixtures prove mechanics only (see acceptance-protocol.md § Honesty rules).

## Change log

- 2026-11-17: created (S-2-00 executed late, after M2 alpha completion by owner directive).
