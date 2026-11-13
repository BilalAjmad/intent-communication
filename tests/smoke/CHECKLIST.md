# Tier 1 Smoke Checklist

Generated from `docs/test.md` section 8.2. 16 lines. Empty result column —
fill in after running each command on a clean machine.

| # | Command | Agent | Expected | Result |
|---|---------|-------|----------|--------|
| 1 | `git clone <repo-url> intent` | human | repo cloned | |
| 2 | `cd intent && pnpm install` | human | deps installed | |
| 3 | `pnpm build` | human | all packages build | |
| 4 | `node packages/cli/dist/cli.js init` | human | `.intent/` created | |
| 5 | `node packages/cli/dist/cli.js doctor` | human | all checks passed | |
| 6 | Open Claude Code in the project | human | agent loads | |
| 7 | Say "Design a booking app for my salon" | human | interview starts | |
| 8 | Answer the interview questions | human | summary approved | |
| 9 | See the first scene | human | scene rendered | |
| 10 | Say "open the studio" | human | studio URL shown | |
| 11 | Select an object, send feedback | human | feedback sent | |
| 12 | Say "check my feedback" | human | feedback applied | |
| 13 | `intent-studio export html` | human | HTML file created | |
| 14 | Open the HTML file by double-click | human | prototype opens | |
| 15 | `node packages/cli/dist/cli.js doctor` | human | all checks passed | |
| 16 | `pnpm verify` | human | all 12 steps pass | |
