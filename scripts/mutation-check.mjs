#!/usr/bin/env node
/**
 * MUTATION CHECK (section F)
 *
 * For each guard (lock, conflict, scope per trd 6.2, descendant-lock, schema
 * validation), this script edits the SOURCE in core, builds core, runs the
 * core test suite, requires at least one named failing test, then restores the
 * source in a finally block. A surviving mutation fails verify.
 *
 * Prints each mutation and the failing test name.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(__dirname, '..');
const CORE_SRC = resolve(ROOT, 'packages/core/src');

const MUTATIONS = [
  {
    name: 'Lock check (E_LOCKED)',
    file: 'pipeline.ts',
    oldString: 'const acquired = await lockPort.acquire(sceneId, patch.objectId);',
    newString: 'const acquired = true; // MUTATED: lock check removed',
    expectedFailingTest: 'M1: Lock check',
  },
  {
    name: 'Conflict check (E_CONFLICT)',
    file: 'pipeline.ts',
    oldString: 'if (patch.baseRevision !== scene.revision || changedObjectIds.length > 0) {',
    // Deliberately NOT a compile-time constant (which breaks narrowing of the
    // early null guard and fails the build): a runtime comparison that is always false.
    newString: 'if (patch.baseRevision > Number.MAX_SAFE_INTEGER && changedObjectIds.length > 0) { // MUTATED: conflict check removed',
    expectedFailingTest: 'M2: Conflict check',
  },
  {
    name: 'Scope check (E_NOT_FOUND, trd 6.2)',
    file: 'patch.ts',
    oldString: 'const pathParts = assertSafePatchPath(validated.path, validated.op);',
    newString: 'const pathParts: string[] = []; // MUTATED: scope check removed',
    expectedFailingTest: 'M3: Scope check',
  },
  {
    name: 'Descendant-lock check (E_LOCKED)',
    file: 'pipeline.ts',
    oldString: 'let current = scene.objects[patch.objectId]?.parentId;',
    newString: 'let current = null; // MUTATED: ancestor-lock check removed',
    expectedFailingTest: 'M4: Descendant-lock check',
  },
  {
    name: 'Schema validation (E_SCHEMA)',
    file: 'storage-port.ts',
    oldString: 'return validateScene(parsedScene);',
    newString: 'return parsedScene as Scene; // MUTATED: schema validation removed',
    expectedFailingTest: 'M5: Schema validation',
  },
];

// Crash safety: each mutated file gets a `.mutation-bak` copy taken BEFORE the
// mutation is applied, and restored in the finally block. If the process dies
// mid-cycle (power loss, session kill, restart), the backup survives on disk.
const BAK_SUFFIX = '.mutation-bak';
const MUTATION_FILES = [...new Set(MUTATIONS.map((m) => resolve(CORE_SRC, m.file)))];

function restoreFromBackups() {
  let restored = 0;
  for (const filePath of MUTATION_FILES) {
    const bak = filePath + BAK_SUFFIX;
    try {
      if (existsSync(bak)) {
        copyFileSync(bak, filePath);
        rmSync(bak, { force: true });
        restored++;
      }
    } catch {
      // best effort
    }
  }
  return restored;
}

// Self-heal: a previous interrupted run may have left a backup behind (or left a
// mutation applied). Restore before doing anything else.
const healed = restoreFromBackups();
if (healed > 0) {
  console.log(`Recovered ${healed} file(s) from a previous interrupted mutation run; rebuilding @intent/core`);
  try {
    execSync('pnpm --filter @intent/core build', { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
  } catch {
    console.error('WARNING: rebuild after recovery failed — rebuild @intent/core manually');
  }
}

process.on('exit', () => {
  restoreFromBackups();
});
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  const signo = { SIGINT: 2, SIGTERM: 15, SIGHUP: 1 }[sig];
  process.on(sig, () => {
    restoreFromBackups();
    process.exit(128 + signo);
  });
}

function extractFailedTestsFromJSON(output) {
  try {
    const data = JSON.parse(output);
    const failed = [];
    if (data.testResults) {
      for (const suite of data.testResults) {
        for (const test of suite.assertionResults || []) {
          if (test.status === 'failed') {
            const fullName = test.fullName || test.title || '';
            if (!failed.includes(fullName)) {
              failed.push(fullName);
            }
          }
        }
      }
    }
    // Also try reading the output file if output is empty
    return failed;
  } catch {
    return [];
  }
}

function runMutation(mutation) {
  const filePath = resolve(CORE_SRC, mutation.file);
  const original = readFileSync(filePath, 'utf-8');
  // Crash safety: backup BEFORE the mutation is applied so an interrupted run
  // can be healed by the startup self-heal pass above.
  copyFileSync(filePath, filePath + BAK_SUFFIX);
  const tmpReport = resolve(os.tmpdir(), `.test-mutation-report-${process.pid}-${Date.now()}.json`);

  try {
    // 1. Apply mutation
    const mutated = original.replace(mutation.oldString, mutation.newString);
    if (mutated === original) {
      throw new Error(`Could not apply mutation: oldString not found in ${mutation.file}`);
    }
    writeFileSync(filePath, mutated);

    // 2. Build core
    execSync('pnpm --filter @intent/core build', {
      cwd: ROOT, stdio: 'pipe', timeout: 120000,
    });

    // 3. Run core tests (mutation.test.ts specifically) with JSON output
    let output = '';
    let exitCode = 0;
    try {
      output = execSync(
        `pnpm --filter @intent/core exec vitest run src/mutation.test.ts --reporter=json "--outputFile=${tmpReport}" --testTimeout=30000`,
        { cwd: ROOT, stdio: 'pipe', timeout: 120000, maxBuffer: 64 * 1024 * 1024 }
      ).toString();
    } catch (e) {
      exitCode = 1;
      output = e.stdout ? e.stdout.toString() : (e.stderr ? e.stderr.toString() : '');
    }

    // 4. Check for expected failing test in vitest JSON
    // Read from the output file (more reliable than stdout)
    let jsonOutput = output;
    try {
      const fileContent = readFileSync(tmpReport, 'utf-8');
      if (fileContent && fileContent.trim().startsWith('{')) {
        jsonOutput = fileContent;
      }
    } catch {
      // Fall back to stdout
    }
    // Always clean up the per-run report file — never let a stale report leak
    // into a later run and manufacture a false "DETECTED".
    try { rmSync(tmpReport, { force: true }); } catch { /* best effort */ }
    const failedTests = extractFailedTestsFromJSON(jsonOutput);
    const expectedFailed = failedTests.find((t) => t.includes(mutation.expectedFailingTest));

    const detected = !!expectedFailed;
    console.log(
      detected
        ? `MUTATION ${mutation.name}: DETECTED - ${expectedFailed}`
        : `MUTATION ${mutation.name}: SURVIVED - no failing test matching "${mutation.expectedFailingTest}"`
    );

    if (!detected) {
      console.error('Full test output:');
      console.error(output.slice(0, 5000));
      throw new Error(`Surviving mutation: ${mutation.name}`);
    }

    return { name: mutation.name, detected: true, failingTest: expectedFailed };
  } finally {
    // 5. Restore original source in finally block (from the pre-mutation backup)
    try {
      copyFileSync(filePath + BAK_SUFFIX, filePath);
    } catch {
      writeFileSync(filePath, original);
    }
    try {
      rmSync(filePath + BAK_SUFFIX, { force: true });
    } catch {
      // Best effort cleanup
    }
    try {
      rmSync(tmpReport, { force: true });
    } catch {
      // Best effort cleanup
    }
    try {
      execSync('pnpm --filter @intent/core build', {
        cwd: ROOT, stdio: 'pipe', timeout: 120000,
      });
    } catch {
      // Best effort restore build
    }
  }
}

async function main() {
  console.log('=== MUTATION CHECK (section F) ===\n');
  const results = [];
  for (const mutation of MUTATIONS) {
    const result = runMutation(mutation);
    results.push(result);
  }

  const survived = results.filter((r) => !r.detected);
  console.log(`\n${results.length} mutations checked, ${survived.length} survived`);
  if (survived.length > 0) {
    console.error('\nSURVIVING MUTATIONS (verify fails):');
    for (const s of survived) {
      console.error(`  - ${s.name}`);
    }
    process.exit(1);
  } else {
    console.log('\nAll mutations detected. No surviving mutations.');
    process.exit(0);
  }
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
