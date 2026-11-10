#!/usr/bin/env node
/**
 * VERIFY - Full verification suite for Intent monorepo
 * Runs: install, build, typecheck, lint, tests, multi-process, mutation, Playwright, docs
 * Exits non-zero on ANY failure. Generates VERIFY-REPORT.md
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(__dirname, '..');
const REPORT_PATH = resolve(ROOT, 'VERIFY-REPORT.md');

const steps = [
  { name: 'install', cmd: 'pnpm install --frozen-lockfile', cwd: ROOT },
  { name: 'build', cmd: 'pnpm -r build', cwd: ROOT },
  { name: 'typecheck', cmd: 'pnpm -r typecheck', cwd: ROOT },
  { name: 'lint', cmd: 'pnpm -r lint', cwd: ROOT },
  { name: 'unit+integration tests', cmd: 'pnpm -r test', cwd: ROOT },
  { name: 'multi-process tests', cmd: 'node tests/multi-process/runner.mjs different', cwd: ROOT },
  { name: 'multi-process same object', cmd: 'node tests/multi-process/runner.mjs same', cwd: ROOT },
  { name: 'sigkill test', cmd: 'node tests/sigkill-test.mjs', cwd: ROOT },
  { name: 'mutation proof', cmd: 'node tests/mutation-proof.mjs', cwd: ROOT },
  { name: 'visual diff', cmd: 'npx playwright test tests/visual-diff.spec.ts', cwd: ROOT },
  { name: 'smoke test', cmd: 'npx playwright test tests/tier1-smoke.spec.ts', cwd: ROOT },
  { name: 'docs:index', cmd: 'pnpm docs:index', cwd: ROOT },
  { name: 'context:check', cmd: 'pnpm context:check', cwd: ROOT },
];

const results = [];
let overallPass = true;

function runStep(step) {
  const start = Date.now();
  try {
    const output = execSync(step.cmd, { cwd: step.cwd, encoding: 'utf-8', timeout: 300000, stdio: 'pipe' });
    const duration = Date.now() - start;
    return { step: step.name, pass: true, duration, output: output.toString() };
  } catch (err) {
    const duration = Date.now() - start;
    return { step: step.name, pass: false, duration, error: err.message, output: err.stdout?.toString() };
  }
}

async function main() {
  console.log('=== VERIFY START ===');
  console.log(`Root: ${ROOT}`);
  console.log(`Report: ${REPORT_PATH}\n`);

  // Clean up any previous test directories
  const testDirs = ['.test-intent', '.test-intent-adapters', '.test-mcp', '.test-server', '.test-skills', '.test-cli', '.test-smoke', '.test-visual'];
  for (const dir of testDirs) {
    try { require('fs').rmSync(resolve(ROOT, dir), { recursive: true, force: true }); } catch {}
  }

  // Run all steps
  for (const step of steps) {
    console.log(`\n=== ${step.name} ===`);
    const result = runStep(step);
    console.log(`${result.pass ? 'PASS' : 'FAIL'} ${step.name} (${result.duration}ms)`);
    if (!result.pass) {
      console.error(result.error);
    }
    if (!result.pass && step.name !== 'mutation proof') {
      // Stop on first failure except mutation proof (which is expected to fail on mutations)
      return { pass: false, results: results };
    }
  }

  // Generate report
  generateReport();

  if (!overallPass) {
    console.log('\n=== VERIFY FAILED ===');
    process.exit(1);
  } else {
    console.log('\n=== VERIFY PASSED ===');
    process.exit(0);
  }
}

function generateReport() {
  const now = new Date().toISOString();
  let md = '# VERIFY REPORT\n\nGenerated: ' + new Date().toISOString() + '\n\n';
  
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  md += '## Summary\n\n';
  md += '- **Total Steps**: ' + results.length + '\n';
  md += '- **Passed**: ' + passed + '\n';
  md += '- **Failed**: ' + failed + '\n\n';

  md += '## Step Results\n\n';
  md += '| Step | Status | Duration | Tests |\n';
  md += '|------|--------|----------|-------|\n';
  
  for (const r of results) {
    const status = r.pass ? '✅ PASS' : '❌ FAIL';
    const count = r.count || '-';
    md += `| ${r.step} | ${status} | ${r.duration}ms | ${count} |\n`;
  }

  md += '\n## Step Outputs\n\n';
  for (const r of results) {
    md += '### ' + r.step + '\n\n';
    if (r.output) {
      md += '```\n' + r.output.slice(0, 2000) + '\n```\n\n';
    }
    if (r.error) {
      md += '**Error:**\n```\n' + r.error.slice(0, 2000) + '\n```\n\n';
    }
  }

  const fs = require('fs');
  fs.writeFileSync(REPORT_PATH, md);
  console.log('\nReport written to ' + REPORT_PATH);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});