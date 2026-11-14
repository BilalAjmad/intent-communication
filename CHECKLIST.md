# Intent v0.1.0 — Release Candidate Checklist

> **Update 2026-11-14 (pass 3):** verify re-run after AC-M1-07 work + mutation-check crash fix: 12/12 PASS, unit+integration **317/317**. Table below is the 2026-11-13 snapshot (263 tests at that time).

## Build & Test Status

All 12 verify steps pass (see VERIFY-REPORT.md for evidence).

| Step | Status |
|------|--------|
| install | PASS |
| build | PASS |
| typecheck | PASS |
| lint | PASS |
| unit+integration tests | PASS (263 tests at that time; 317/317 as of 2026-11-14) |
| multi-process tests | PASS |
| sigkill test | PASS |
| mutation proof | PASS |
| visual diff (Playwright) | PASS |
| smoke test (Playwright) | PASS |
| docs:index | PASS |
| context:check | PASS |

## Package Test Counts

| Package | Tests |
|---------|-------|
| schema | 31 |
| core | 85 |
| linter | 17 |
| engine | 42 |
| adapters-node | 19 |
| mcp-server | 25 |
| server | 21 |
| studio | 5 |
| skills | 9 |
| cli | 9 |
| **Total** | **263** |

## Security (SEC-01..SEC-07)

All 19 security tests pass (SEC-09 oversized body, SEC-01..SEC-07 groups).

## Known Limitations

- M2/M3 features not yet implemented (drag/resize, pencil, Scanner, profile learning, React export).
- Windows/macOS CI evidence pending.
- No network requests from any package (verified by grep test).
