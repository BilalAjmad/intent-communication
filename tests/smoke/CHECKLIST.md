# Smoke Test Checklist (test.md 8.2)

Run with: `pnpm test:smoke` or manually with commands below.

| # | Test | Command | Expected | Result |
|---|------|---------|----------|--------|
| 1 | Fresh clone installs | `pnpm install` | Succeeds, no errors | [ ] |
| 2 | All unit tests pass | `pnpm test` | 169+ tests pass | [ ] |
| 3 | Typecheck passes | `pnpm -r typecheck` | No errors | [ ] |
| 5 | Lint passes | `pnpm -r lint` | No errors | [ ] |
| 6 | Build succeeds | `pnpm -r build` | All packages build | [ ] |
| 7 | CLI init | `node packages/cli/dist/cli.js init --path .test` | Creates .intent/ | [ ] |
| 8 | CLI doctor | `node packages/cli/dist/cli.js doctor --path .test` | "All checks passed" | [ ] |
| 9 | CLI export | `node packages/cli/dist/cli.js export --path .test` | Creates export-default.html | [ ] |
| 10 | Exported HTML opens | Open export-default.html in browser | Loads, no errors | [ ] |
| 11 | Exported HTML zero network | Open in devtools Network tab | 0 network requests | [ ] |
| 11 | Exported HTML navigation | Click links/buttons | Navigation works | [ ] |
| 12 | CLI export visual-diff | `pnpm playwright test tests/visual-diff.spec.ts` | Screenshot matches baseline | [ ] |
| 13 | Multi-process different | `node tests/multi-process/runner.mjs different` | 4 writes, revision=4 | [ ] |
| 14 | Multi-process same | `node tests/multi-process/runner.mjs same` | 1 success, 3 conflicts | [ ] |
| 15 | SIGKILL test | `node tests/sigkill-test.mjs` | Lock broken, write succeeds | [ ] |
| 15 | Mutation proof | `node tests/mutation-proof.mjs` | Lock/conflict/scope checks fail | [ ] |
| 16 | CI runs | `gh run list` | 3 OS green | [ ] |

Run all: `pnpm verify` (runs full suite including CI matrix)

**Do not fill in yourself - this is for manual verification by the human.**