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
import { readFileSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';
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
    oldString: 'if (patch.baseRevision !== currentScene.revision || changedObjectIds.length > 0) {',
    newString: 'if (false) { // MUTATED: conflict check removed',
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
    file: 'ports.ts',
    oldString: 'return validateScene(JSON.parse(content));',
    newString: 'return JSON.parse(content) as Scene; // MUTATED: schema validation removed',
    expectedFailingTest: 'M5: Schema validation',
  },
];

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
    const tmpReport = resolve('C:/Users/AFZAAL~1/AppData/Local/Temp', '.test-mutation-report.json');
    let output = '';
    let exitCode = 0;
    try {
      output = execSync(
        `pnpm --filter @intent/core exec vitest run src/mutation.test.ts --reporter=json --outputFile=${tmpReport} --testTimeout=30000`,
        { cwd: ROOT, stdio: 'pipe', timeout: 120000 }
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
    // 5. Restore original source in finally block
    writeFileSync(filePath, original);
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
