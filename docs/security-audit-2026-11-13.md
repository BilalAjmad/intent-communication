# Intent — Security Audit — 2026-11-13

**Target**: `H:\intent communication` (branch `main`, HEAD `d825918` before this audit's commits)
**Method**: automated scanning (gitleaks, Trivy, pnpm audit) + source-level review of the trust boundaries (HTML exporter, HTTP server, MCP server, CLI, studio) with **live browser reproduction** of exploitable findings.
**Verdict**: before this audit, the exported prototype HTML was vulnerable to **two independent browser-verified stored-XSS classes**, and the Studio server's authentication was **entirely unimplemented**. Both are fixed in commit `*`; the rest of this file records the evidence.

---

## 1. Automated scans

| Tool | Result |
|------|--------|
| gitleaks (git history + worktree, 24 commits, 2.32 MB) | **No leaks found** |
| Trivy `fs --scanners vuln,secret,misconfig` (HIGH/CRITICAL) | **0 vulnerabilities, 0 secrets, 0 misconfigurations** |
| Trivy `fs` at **all** severities | **0 vulnerabilities** |
| `pnpm audit --audit-level low` | 19 advisories — **all in dev-only transitive deps** (vitest/vite/tinypool/esbuild/glob/minimatch) **except `zod` (HIGH)** |

### zod HIGH (GHSA-mrhx-c7xc-m3w5) — production dependency, `zod@3.25.76`

"Zod can exhaust memory while validating oversized constrained collections."
Fix: upgrade to zod >= 4.6.6 (breaking major) or, at minimum, enforce the trd 20 size limits **before** validation (below). The schema currently declares unbounded collections (`objects: z.record(...)`, `children: z.array(...)`, `content: z.string()`, `props: z.record(...)` with `.passthrough()`), and threads every scene — including attacker-influenced content from agent patches — straight into `validateScene`. Combined with **no size cap on scene-file reads** (`fs.readFile(scenePath)` in `createStoragePort.readScene`), a large `.intent/scenes/*.json` triggers unbounded memory use. **Needs Validation**: the concrete PoC depends on whether an agent can be prompted into emitting oversized content. Recommendation: implement trd 20 limits in the *schema* (objects ≤ 2000, text ≤ 2000 chars, tree depth ≤ 24, children ≤ 200) and cap reads at 5 MB, which neutralises this regardless of the zod upgrade.

### dev-only advisories
Accepted risk for a local CLI/dev-tool: they are only reachable by running the test suite. Fix cadence: bump vitest/vite on the next dependency window.

---

## 2. Confirmed and fixed — exported prototype HTML is the product's deliverable and it executed attacker text

### Finding A (HIGH) — Stored XSS via `JSON.stringify` into a `<script>` block
`packages/engine/src/html.ts` (before fix) embedded the whole scene with
`window.__INTENT_SCENE__ = ${JSON.stringify(validated)};`
`JSON.stringify` does not escape `<`, so any scene string containing `</script>` closed the script element early.

**Reproduction (real Chromium, `file://`)**: a text object whose content was
`</script><script>window.__PWNED__='xss-executed'</script>` exported by
`exportToHtml` produced a page with **3 `<script>` opens and 4 `</script>` closes**, and after load `window.__PWNED__ === "xss-executed"`.

**Fix**: `escapeJsonForScript()` in `packages/engine/src/sanitize.ts` escapes `<`→`\u003c`, `>`→`\u003e`, `&`→`\u0026`, and the JS line separators. Re-proved in the browser: `window.__PWNED__ === undefined`, zero page errors, scene JSON still parses, inline scripts still run.

### Finding B (HIGH) — Attribute injection through the Zod union fallback
`SceneObjectSchema` (`packages/schema/src/index.ts`) unions the typed object schemas with an **unconstrained `BaseObjectSchema`** as its last member. An invalid enum value (`variant`, `fit`, `type`) fails the typed schema and is *accepted* by the fallback. The engine then interpolated those values into HTML attributes **without escaping**:
- `<button class="intent-button intent-button-PAYLOAD">` (`variant`)
- `<img class="intent-image intent-fit-PAYLOAD">` (`fit`)
- `<input type="PAYLOAD">` (`type`)

Payload `" onload="window.__XSS_IMG__=1` etc.

**Reproduction (real Chromium)**: `window.__XSS_BUTTON__ === 1`. The injected attribute executed.

**Fix**: `safeClassToken()` allowlists `[A-Za-z0-9_-]+` (falling back to the schema default) for `variant`/`fit`; the input `type` is matched against an allowlist of the six spec'd types; `data-*` IDs and enum-influenced attributes escape via `escapeHtml`; invalid values silently degrade to the default instead of reaching the document.

### Finding C (MEDIUM) — No Content-Security-Policy was emitted
The `cspNonce` export option added a `nonce="…"` attribute to `<style>`/`<script>` but **no CSP meta tag was ever written**, so the nonce was inert and the document ran with no CSP at all.
**Fix**: `buildCsp()` emits trd 13.3's policy — `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'` — plus `'nonce-<n>'` added to `script-src` when a nonce is supplied. Verified: the exported page loads, renders, and executes its click handler with zero network requests.

### Finding D (MEDIUM) — No URL allowlist; external URLs emitted
`props.src` was escaped for HTML but never validated. `https://example.com/img.png` was emitted verbatim as `<img src>` (and not as a resource the CSP blocks — browser would fetch it). `javascript:alert(1)` passed zod's `.url()` (verified: `z.string().url().safeParse('javascript:alert(1)').success === true`). Violates **trd rule 8** ("Exports contain no external URLs except `href="#s-…"` and `data:` images") and makes the Playwright "zero network requests" test vacuous (it only exercised the no-image default scene).
**Fix**: `sanitizeUrl()` — allows `data:image/{png,jpeg,webp,gif};base64,…` (per trd 13.5), `#fragment` navigation IDs, and scheme-less relative paths; drops `http:`, `https:`, `javascript:`, `file:`, etc. `<img src>` now carries `src=""` when the URL is rejected. The engine test that asserted `toContain("https://example.com/img.png")` was rewritten to assert the opposite.

### Finding E (MEDIUM) — CSS value injection (`url()`, statement separators, CSS escapes)
`buildStyleString` interpolated raw values into a `style` attribute. `background: url(https://evil.example.com/pixel.png)` was emitted (external request, tracking pixel, data exfiltration). Violates **trd 13.2** (`assertSafeCssValue` — closed grammar, drop everything else).
**Fix**: `sanitizeCssValue()` drops any value containing `url(`, `;`, `{`, `}`, `\`, over-512-char strings, or a character outside `[A-Za-z0-9#.,%()\-_+"' /]`.

### Regression coverage added
`packages/engine/src/security.test.ts` — 24 tests pinning every finding above, written against the *rendered tag markup* (payloads may still appear as inert JSON data). 17 pre-existing engine tests updated; the one that enshrined the trd-rule-8 violation now asserts the correct behaviour. Browser-verified fixes for Finding A and Finding B.

---

## 3. Confirmed and fixed — the Studio server's authentication was a stub

### Finding F (HIGH) — `/api/session` accepted any non-empty token
`POST /api/session` validated only "non-empty string" (source comment: "In production, validate token against runtime.json / For now, accept any non-empty token") and stored the **attacker-supplied token verbatim** as the session cookie value.

### Finding G (HIGH) — `/api/protected`, `/mcp` and `/events` required nothing
`/api/protected` accepted any cookie present. `/mcp` performs scene **read and write** (get_scene, get_feedback, apply_patch, ask_user, validate, open_studio) with no cookie, no token, no Host/Origin check. `/events` streamed scene contents to anyone.
Net effect: the "loopback only" threat model was not actually enforced — any local process (a compromised dev dependency, a malicious npm package) could read the entire scene and send patches to corrupt it.

**Fix (packages/server/src/index.ts)** implements trd 11.2:
- `IntentServer` generates a per-run 256-bit token if `config.sessionToken` is absent (or accepts the configured one), and writes `.intent/runtime.json` (`{port, pid, token, startedAt}`, mode `0600`) on `start()`. **Note**: before this, *nothing* in the repo wrote `runtime.json` — the token lifecycle was entirely missing.
- `POST /api/session` requires exact Host, 16 KB body cap (`413` on overflow), constant-time token comparison (`crypto.timingSafeEqual`), and on success sets a cookie with a **random 256-bit session id** — `HttpOnly; SameSite=Strict; Path=/api; Max-Age=1800` — and returns `204` (spec value), never the token.
- Every route enforces exact Host (`127.0.0.1:<port>` or `localhost:<port>`), and every non-GET enforces an `Origin` identical to `http://<that host>`; preflight (OPTIONS) is **refused** (403); all failures are 403 with no detail.
- `/api`, `/mcp`, `/events`, static files — all require an unexpired session cookie (30 min idle). `/api/protected` no longer echoes the cookie value. Bodies are read with a 2 MB cap (413).
- The 24-hour cookie (`Max-Age=86400`, `Path=/`) is now 30 minutes, `Path=/api`, as the spec requires.
- `Referrer-Policy: no-referrer`, `frame-ancestors 'none'` added.
- Session ids compare in constant time and expire.

### Finding H (HIGH) — The auth tests were vacuous
`SEC-02 (wrong cookie)` asserted `expect([200, 403]).toContain(status)` — passes either way.
`SEC-06` asserted the cookie **contained the token** (i.e. enshrined the bug).
`SEC-07` asserted `[403, 404].toContain` and never checked for leaked contents.
Two mcp-server "conformance" tests asserted `expect(true).toBe(true)` — pure placeholders claiming to cover the server's SEC-01..SEC-07 surface.

**Fix**: `packages/server/src/security.test.ts` — 19 tests pinning the real contract: wrong token → 403; exchange → 204; cookie carries a random 256-bit `Path=/api` session id that is *not* the token; `/api/protected`, `/mcp`, `/events` all 403 without it; valid cookie reaches them; oversized body → 413; OPTIONS → 403; `Referrer-Policy`/`nosniff` present. The tautologies are replaced by assertions over the live response plus a static scan that `SEC-01..SEC-07` exist in the server suite. SEC-01 still asserts loopback bind; SEC-03 now unit-tests `checkHost`.

---

## 4. Recorded, understood, deliberately not "fixed" by this audit

| Ref | Issue | Why not now |
|-----|-------|-------------|
| I | **The Studio SPA never performs the fragment→cookie exchange.** Nothing in `packages/studio/src` reads `location.hash` / `history.replaceState`. The real browser flow (trd 11.2 steps 1–2) is unimplementable until the React SPA exists (Phase 5 / M2). With the new server, a real browser opening the studio without that exchange gets 403 on `/mcp`. | Built in Phase 5 or M2. The Node `Studio` class and its tests don't hit the HTTP server. |
| J | **trd 20 limits are not implemented anywhere** — objects/scene (2000), text (2000 chars), children (200), tree depth (24), ops/patch (200), scene-file size (5 MB), `maxBytes` application. Directly relevant to the zod HIGH and to memory-exhaustion of `readScene`. | Needs schema changes + migration thinking; scheduled with the Phase 4/5 hardening, not this audit. |
| K | **`runtime.json` is written but nothing reads it yet**, and idle-timeout enforcement works but is not wired to a shutdown timer. | The launcher (`open` / `open_studio` in the CLI) is Phase 6. |
| L | **Static-file symlink check absent** (`serveStatic` does not reject symlinks; adapters-node does). A local attacker who can plant a symlink under `.intent/studio/` could serve arbitrary files. | Accepted risk: the threat is a local process planting into `.intent/`, which already implies file-system access to the user's own project. |
| M | **`pnpm audit` dev-only vite/vitest/tinypool advisories** (3 critical, 13 moderate, 1 low, 2 high). | Bumping vitest/vite 2.1.9 → latest is a dependency-window task. Test tooling only. |
| N | **The spec's `/api/*` route table (trd 11.3) does not exist.** The server exposes `/mcp` (a passthrough to the MCP tool handlers) instead of `/api/scene`, `/api/ops`, `/api/patches`, `/api/annotations`, `/api/locks`, `/api/versions`, `/api/interview`, `/api/lint`, `/api/export/:target`, `/api/config`, `/api/events`. Server + MCP never said to each other "the spec has a whole HTTP API that isn't built". | Real gap for the Studio shell (Phase 5). Not silently patched. |
| O | **`/mcp` returns internal error messages verbatim** (`(error as Error).message`). Could leak paths/stack on unexpected errors. | Low risk locally; polish in Phase 5. |
| P | **No idle shutdown timer** on the Studio server (trd: default 30 min). | Phase 6 (launcher). |
| Q | **`get_scene` on a missing scene returns `E_NOT_FOUND`** — correct; but there is no `POST /api/ops` etc., so a fully-authenticated browser cannot build a mutation flow on the documented API. | Same as N. |
| R | `createStoragePort` writes `${scene}.tmp.${Date.now()}.${rand}` temp files and never cleans them on failure. | Cleanup task in Phase 6. |

---

## 5. Summary

| Class | Found | Fixed in this audit |
|-------|-------|--------------------|
| Exported-HTML XSS (2 browser-verified classes) | 2 | ✅ |
| Exporter CSP / URL allowlist / CSS grammar | 3 | ✅ |
| Server auth (token exchange, session cookie, `/mcp`, `/events`, `/protected`) | 6 | ✅ |
| Auth test vacua / tautologies | 4 | ✅ |
| zod HIGH (needs size caps) | 1 | ⏳ Scheduled (J) |
| trd 20 limits absent | 1 class | ⏳ Scheduled (J) |
| Spec'd Studio HTTP API absent | 1 | ⏳ Scheduled (N) |
| Dev-only dependency advisories | 19 | ⏳ Next dependency window (M) |
| Lint/typecheck/build clean | — | ✅ |

**Counts after this commit**: 252 unit/integration tests pass (was 194, of which 20 failed), 11 Playwright tests pass, `lint` clean, `typecheck` clean, `build` clean, 10/10 multi-process runs green.
