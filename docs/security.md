# Security Notes — Advisory Tracking

Status as of 2026-11-18.

## Current audit state: **1 high finding — accepted, no patch available**

`pnpm audit` reports: **picomatch <= 4.0.7** (≥4.0.4 vulnerable) — ReDoS through
single-branch repeated extglobs (advisory text: "picomatch vulnerable to ReDoS
through single-branch repeated extglobs").

- **Path**: dev/test toolchain only — `@typescript-eslint/eslint-plugin@8.72.x >
  @typescript-eslint/typescript-estree > tinyglobby > fdir > picomatch@4.0.7`
  (and `tinyglobby > picomatch@4.0.7` directly).
- **Not a runtime dependency.** Intent's shipped packages (`@intent/*`) bundle no
  picomatch; it is reached only via the ESLint toolchain parsing developer-authored
  glob patterns.
- **Exploitability**: ReDoS requires an attacker to control the glob pattern fed
  to picomatch — in this repo all such patterns are authored by the user, for the
  user's own lint invocation. No remote input reaches it.
- **No patch exists**: the registry shows no picomatch 4.x fix (4.0.4–4.0.7 all
  flagged; `Patched versions: <0.0.0`). Upstream (`tinyglobby`, `fdir`) has no
  released path pinned to a fixed picomatch.
- **Decision**: accept and document; revisit on the next
  `pnpm audit` after any upstream release that fixes picomatch. Do **not** override
  picomatch to an older/different major — unverified change to the dev toolchain
  would not eliminate the advisory and could break the build.

Evidence:
- `pnpm audit` → 1 high, package `picomatch`, paths shown above.
- `trivy fs` on the repository (pnpm-lock.yaml) → 0 findings.
- `nuclei` (security headers / sensitive-file exposure on the Studio HTTP
  surface) → headers present; `/.git/config`, `/.env`, `/.intent/config.json`
  all refused; evidence in session logs.
- `pnpm audit` in CI reports nonzero exit on this advisory; the verify pipeline
  does not fail on audit (audit is not a verify step); the finding stands as
  documented here.

## Historical audits (dates are UTC)

- 2026-11-16: 0 known vulnerabilities (zod migration closed GHSA-mrhx-c7xc-m3w5;
  vitest 5.1.0, vite 8.3.8, minimatch override).
- 2026-11-18: 1 high (picomatch, accepted above).
