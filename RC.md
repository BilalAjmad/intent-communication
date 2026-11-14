# Intent v0.1.0 — Release Candidate Status

> **Update 2026-11-14 (pass 3):** `pnpm verify` re-verified end-to-end after the AC-M1-07 work and the mutation-check crash fix: 12/12 PASS, unit+integration **316/316** (was 286/286). New crypto-strong evidence now exists for the preview/export claim: `tests/fidelity-pixel.spec.ts` (6 FX fixtures × light/dark × phone/tablet/desktop, Playwright pixel matcher, maxDiffPixels: 0; 20/20 calibration runs at 0 diff on Windows 11) and `tests/visual-diff.spec.ts` rewritten to real pixel comparison (it previously counted compressed-PNG bytes — that metric was meaningless). An interrupted `pnpm verify` had left `packages/core/src/patch.ts` with the trd 6.2 scope check disabled; it was restored from git and `scripts/mutation-check.mjs` is now crash-safe (pre-mutation backup + startup self-heal + signal handlers). The M1 gate verdict is still **NOT READY for v0.1.0** — see docs/review.md §21/§21.1. Numbers below are the 2026-11-13 historical snapshot.

Date: 2026-11-13
HEAD: see `git log --oneline -3` (docs recorded by this RC; the claims below verified on HEAD after the Phase 2 commits)

## Summary

M1 milestone regression pass complete (as of this date, in-tree). All 12 verify steps pass.
Then it was found that the registry object-lock design could deadlock objects for
crashed writers; that is now fixed (stale-owner reclaim + owner-token release), and the
applyPatch path is hardened against traversal/prototype pollution and forbidden roots.
Re-verified end-to-end: `pnpm verify` → 12/12 PASS, unit+integration tests 263/263 pass.

## Changes since HEAD@4b581af (d825918/4b581af → this pass)

- `packages/core/src/ports.ts`: rework `createLockPort` — per-object locks are now entries in
  `.intent/locks/<sceneId>.locks.json` (LocksFile `lockedObjects` array). Atomic writes go through
  `writeAtomic` in `atomic.ts`. Scene lock uses an ownerToken re-verify + exponential backoff
  with jitter (10ms→×1.6, cap 250ms, ±20% jitter). Object locks now carry `{ pid, ownerToken, createdAt }`
  in an additive `owners` map (non-breaking for existing files; legacy entries have no owner info
  and are kept conservatively). `acquire()` reclaims entries whose owner is dead or stale (>10 s).
  `release()` only removes the entry this process registered; foreign entries are never unlinked.
  `getLockedObjects()` filters dead/stale entries used by the descendant-lock check.
- `packages/core/src/atomic.ts`: new file — atomic write with fsync, Windows rename retry
  (20/40/80/160/320 ms), `E_IO` on failure, symlink protection. Shared by all storage ports.
- `packages/core/src/patch.ts`: applyPatch path hardened — trd 6.2 root whitelist for set/unset
  (name, visible, size, position, margin, style, layout, props, a11y, interactions, responsive),
  `E_BAD_REQUEST` otherwise; rejects `..`, `.`, empty segments, `__proto__`, `constructor`,
  `prototype`; path lengths and part patterns capped.
- `packages/core/src/patch.test.ts`: new — 7 path-safety tests incl. `../../escape`, prototype
  pollution, forbidden roots, and valid-path control.
- `packages/core/src/lock-stale.test.ts`: new — 4 stale-owner/reclaim tests for the registry.
- `packages/schema/src/index.ts`: `LocksFileSchema` gains optional `owners` map (additive).
  Schema kept at 496 lines (≤500 budget). ISODateTime/PrimitiveValue compacted.
- `packages/adapters-node/src/index.ts`: storage ports use `writeAtomic`; `createFileLockPort` updated for the new signature.
- `tests/`: multi-process/sigkill workers updated for the new lock port signature; mutation-proof
  and mutation-check updated for vitest v2 JSON output and the new patch.ts anchor.
- `scripts/verify.mjs`: ANSI-escape-safe test-count extraction (real count = 263 now); supports
  vitest v2 schema. `scripts/mutation-check.mjs`: patch.ts anchor updated; reads vitest v2 JSON
  from the report file. `tests/mutation-proof.mjs`: rewritten to the same pipeline coordinates.
- `README.md`: test count updated 252 → 263.

## Verified (this pass, 2026-11-13 ~17:20)

- `pnpm verify` → 12 steps PASS (see VERIFY-REPORT.md, unit+integration 263/263)
- `pnpm lint` → 0 errors
- `pnpm typecheck` → 0 errors
- Multi-process tests: 2/2 PASS in verify; 10 consecutive runs PASS (explicit flake sample)
- Mutation check: 5/5 mutations detected (lock, conflict, scope, descendant-lock, schema)
- Context check: all checks pass (schema/src/index.ts = 496 lines, budget 500)
- Security audit (this folder, earlier): two browser-verified exported-HTML XSS classes fixed,
  Studio server auth reviewed and hardened, 19 server SEC tests pass, trivy/gitleaks clean

## Not Verified / Assumptions

- Windows-only CI; network filesystems not tested.
- 10/10 multi-process runs is a sample — the flake is much rarer but not proven extinct.
- README's "All 12 verify steps pass" is supported by VERIFY-REPORT.md, but verify's unit-count
  extraction needed an ANSI fix this pass (fresh report shows 263/263).
- Two agents worked this tree concurrently; this file used to point at a stale HEAD before this pass.
- M2/M3 features not implemented.

## Next Steps

- M2: drag/resize, pencil annotations, React exporter
- M3: Scanner, profile learning, Design Profile
