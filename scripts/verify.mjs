#!/usr/bin/env node
/**
 * VERIFY - Full verification suite for Intent monorepo
 * Runs: install, build, typecheck, lint, tests, multi-process, mutation, Playwright, docs
 * Exits non-zero on ANY failure. Generates VERIFY-REPORT.md
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(__dirname, '..');
const REPORT_PATH = resolve(ROOT, 'VERIFY-REPORT.md');

const steps = [
  { name: 'install', cmd: 'pnpm install --frozen-lockfile', cwd: ROOT },
  { name: 'build', cmd: 'pnpm -r build', cwd: ROOT },
  { name: 'typecheck', cmd: 'pnpm -r typecheck', cwd: ROOT },
  { name: 'lint', cmd: 'pnpm -r lint', cwd: ROOT },
  // Serialized: parallel packages contend for CPU on this machine and flake
  // intermittently (2026-11). Same total suite, same assertions — just 1 package at a time.
  { name: 'unit+integration tests', cmd: 'pnpm -r test --workspace-concurrency=1', cwd: ROOT },
  { name: 'multi-process tests (different objects)', cmd: 'pnpm --filter @intent/core exec vitest run src/multi-process.test.ts --reporter=json --testTimeout=30000', cwd: ROOT },
  { name: 'sigkill test', cmd: 'pnpm --filter @intent/core exec vitest run src/sigkill.test.ts --reporter=json --testTimeout=30000', cwd: ROOT },
  { name: 'mutation proof', cmd: 'node scripts/mutation-check.mjs', cwd: ROOT },
  { name: 'visual diff (Playwright)', cmd: 'npx playwright test tests/visual-diff.spec.ts --reporter=json', cwd: ROOT },
  { name: 'smoke test (Playwright)', cmd: 'npx playwright test tests/tier1-smoke.spec.ts --reporter=json', cwd: ROOT },
  { name: 'docs:index', cmd: 'pnpm docs:index', cwd: ROOT },
  { name: 'context:check', cmd: 'pnpm context:check', cwd: ROOT },
];

const results = [];

function runStep(step) {
  const start = Date.now();
  try {
    const output = execSync(step.cmd, { cwd: step.cwd, encoding: 'utf-8', timeout: 600000, stdio: 'pipe', maxBuffer: 64 * 1024 * 1024 });
    const duration = Date.now() - start;
    return { step: step.name, pass: true, duration, output: output.toString() };
  } catch (err) {
    const duration = Date.now() - start;
    return { step: step.name, pass: false, duration, error: err.message, output: err.stdout ? err.stdout.toString() : (err.stderr ? err.stderr.toString() : '') };
  }
}

function extractTestCountFromVitestJSON(output) {
  try {
    const data = JSON.parse(output);
    // vitest v2 JSON reporter: { numPassedTests, numFailedTests, numTotalTests, testResults[] ... }
    if (typeof data.numTotalTests === 'number') {
      return {
        passed: data.numPassedTests ?? 0,
        failed: data.numFailedTests ?? 0,
        total: data.numTotalTests,
      };
    }
    // Older schema (vitest <=0.34): { results: [{ tests: [{ result }] }] }
    if (Array.isArray(data.results)) {
      let passed = 0, failed = 0, total = 0;
      for (const suite of data.results) {
        for (const test of suite.tests || []) {
          total++;
          if (test.result === 'passed') passed++;
          else if (test.result === 'failed') failed++;
        }
      }
      return { passed, failed, total };
    }
  } catch {
    // Not JSON, fall through to regex
  }
  return null;
}

function extractTestCount(output) {
  // Strip ANSI escape sequences first (they can sit between tokens).
  output = output.replace(/\u001b\[[0-9;]*m/g, '');

  // Try JSON first (vitest --reporter=json)
  const jsonCounts = extractTestCountFromVitestJSON(output);
  if (jsonCounts) return jsonCounts;

  // Fallback to regex: sum "Tests  N passed (N)" lines across all packages.
  const passedMatches = [...output.matchAll(/Tests\s+(\d+)\s+passed/g)];
  const failedMatches = [...output.matchAll(/Tests\s+(\d+)\s+failed/g)];
  if (passedMatches.length || failedMatches.length) {
    const passed = passedMatches.reduce((s, m) => s + parseInt(m[1], 10), 0);
    const failed = failedMatches.reduce((s, m) => s + parseInt(m[1], 10), 0);
    return { passed, failed, total: passed + failed };
  }
  return { passed: 0, failed: 0, total: 0 };
}

async function main() {
  console.log('=== VERIFY START ===');
  console.log('Root: ' + ROOT);
  console.log('Report: ' + REPORT_PATH + '\n');

  const testDirs = ['.test-intent', '.test-intent-adapters', '.test-mcp', '.test-server', '.test-skills', '.test-cli', '.test-smoke', '.test-visual', '.test-visual-diff', '.test-mp-vitest', '.test-mutation', '.test-mutation-simple'];
  for (var i = 0; i < testDirs.length; i++) {
    try { rmSync(resolve(ROOT, testDirs[i]), { recursive: true, force: true }); } catch {}
  }

  for (var i = 0; i < steps.length; i++) {
    var step = steps[i];
    console.log('\n=== ' + step.name + ' ===');
    var result = runStep(step);
    results.push(result);
    var counts = extractTestCount(result.output);
    var countStr = '-';
    if (counts.total > 0) {
      countStr = counts.passed + '/' + counts.total;
      if (counts.failed > 0) countStr += ' (' + counts.failed + ' failed)';
    }
    console.log((result.pass ? 'PASS' : 'FAIL') + ' ' + step.name + ' (' + result.duration + 'ms) [' + countStr + ']');
    if (!result.pass) {
      console.error(result.output.slice(0, 2000));
    }
    if (!result.pass && step.name !== 'mutation proof') {
      generateReport();
      console.log('\n=== VERIFY FAILED ===');
      process.exit(1);
    }
  }

  generateReport();

  var failed = 0;
  for (var i = 0; i < results.length; i++) {
    if (!results[i].pass) failed++;
  }
  if (failed > 0) {
    console.log('\n=== VERIFY FAILED ===');
    process.exit(1);
  } else {
    console.log('\n=== VERIFY PASSED ===');
    process.exit(0);
  }
}

function generateReport() {
  var passed = 0;
  var failed = 0;
  for (var i = 0; i < results.length; i++) {
    if (results[i].pass) passed++; else failed++;
  }
  var md = '# VERIFY REPORT\n\nGenerated: ' + new Date().toISOString() + '\n\n';

  md += '## Summary\n\n';
  md += '- **Total Steps**: ' + results.length + '\n';
  md += '- **Passed**: ' + passed + '\n';
  md += '- **Failed**: ' + failed + '\n\n';

  md += '## Step Results\n\n';
  md += '| Step | Status | Duration | Tests |\n';
  md += '|------|--------|----------|-------|\n';

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    var status = r.pass ? 'PASS' : 'FAIL';
    var counts = extractTestCount(r.output);
    var countStr = '-';
    if (counts.total > 0) {
      countStr = counts.passed + '/' + counts.total;
      if (counts.failed > 0) countStr += ' (' + counts.failed + ' failed)';
    }
    md += '| ' + r.step + ' | ' + status + ' | ' + r.duration + 'ms | ' + countStr + ' |\n';
  }

  md += '\n## Step Outputs\n\n';
  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    md += '### ' + r.step + '\n\n';
    if (r.output) {
      md += '\n```\n' + r.output.slice(0, 3000) + '\n```\n\n';
    }
    if (r.error) {
      md += '**Error:**\n```\n' + r.error.slice(0, 2000) + '\n```\n\n';
    }
  }

  writeFileSync(REPORT_PATH, md);
  console.log('\nReport written to ' + REPORT_PATH);
}

main().catch(function(err) {
  console.error('FATAL:', err);
  process.exit(1);
});
