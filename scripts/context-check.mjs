import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(__dirname, '..');

let allPass = true;
const failures = [];

function fail(msg) {
  allPass = false;
  failures.push(msg);
  console.log('  ❌ ' + msg);
}

function ok(msg) {
  console.log('  ✅ ' + msg);
}

function checkFileExists(relPath, label) {
  const full = resolve(ROOT, relPath);
  const exists = existsSync(full);
  if (exists) ok(label + ': ' + relPath);
  else fail('missing ' + label + ': ' + relPath);
  return exists;
}

function scanDirectory(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'tests', 'scripts'].includes(entry.name)) {
          results.push(...scanDirectory(full));
        }
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js')) {
        results.push(full);
      }
    }
  } catch {
    // directory might not exist
  }
  return results;
}

async function main() {
  console.log('=== CONTEXT CHECK ===\n');

  // 1. Required files
  console.log('\n1. Required files:');
  checkFileExists('package.json', 'package.json');
  checkFileExists('pnpm-lock.yaml', 'pnpm-lock.yaml');
  checkFileExists('pnpm-workspace.yaml', 'pnpm-workspace.yaml');
  checkFileExists('tsconfig.json', 'tsconfig.json');
  checkFileExists('.gitignore', '.gitignore');

  // 2. Package structure
  console.log('\n2. Package structure:');
  const pkgs = ['schema', 'core', 'linter', 'adapters-node', 'engine', 'mcp-server', 'server', 'studio', 'skills', 'cli'];
  for (const pkg of pkgs) {
    const pkgDir = 'packages/' + pkg;
    const hasPkgJson = existsSync('packages/' + pkg + '/package.json');
    const hasSrc = existsSync('packages/' + pkg + '/src');
    if (hasPkgJson && hasSrc) ok('packages/' + pkg);
    else fail('packages/' + pkg + ' missing package.json or src/');
  }

  // 3. No banned imports in packages/*/src
  console.log('\n3. No banned imports (fs, path, child_process, crypto, http, https, net, dgram, dns):');
  const bannedImports = ['fs', 'path', 'child_process', 'crypto', 'http', 'https', 'net', 'dgram', 'dns'];
  const bannedRegex = new RegExp('(require|from)\\s*[\\x27\\x22](' + bannedImports.join('|') + ')[\\x27\\x22]', 'g');
  let bannedCount = 0;
  for (const pkg of pkgs) {
    const files = scanDirectory(resolve(ROOT, 'packages/' + pkg + '/src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      let match;
      while ((match = bannedRegex.exec(content)) !== null) {
        bannedCount++;
        fail('Banned import \'' + match[0] + '\' in ' + relative(ROOT, file));
      }
    }
  }
  if (bannedCount === 0) ok('No banned imports found');

  // 4. No forbidden patterns
  console.log('\n4. No forbidden patterns (UUID, expiresAt, holder, WebSocket, "bold"):');
  const forbiddenPatterns = [
    { name: 'UUID', regex: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ },
    { name: 'expiresAt', regex: /\bexpiresAt\b/ },
    { name: 'holder', regex: /\bholder\b/ },
    { name: 'WebSocket', regex: /\bWebSocket\b/ },
    { name: '"bold"', regex: /\b"bold"\b/ },
  ];
  let forbiddenCount = 0;
  for (const pkg of pkgs) {
    const files = scanDirectory(resolve(ROOT, 'packages/' + pkg + '/src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const { name, regex } of forbiddenPatterns) {
        if (regex.test(content)) {
          forbiddenCount++;
          fail('Forbidden pattern \'' + name + '\' in ' + relative(ROOT, file));
        }
      }
    }
  }
  if (forbiddenCount === 0) ok('No forbidden patterns found');

  // 5. Context budgets per file (max 500 lines per source file)
  console.log('\n5. Context budgets per file (max 500 lines):');
  let oversizedCount = 0;
  for (const pkg of pkgs) {
    const files = scanDirectory(resolve(ROOT, 'packages/' + pkg + '/src'));
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n').length;
      if (lines > 500) {
        oversizedCount++;
        fail('File ' + relative(ROOT, file) + ' has ' + lines + ' lines (max 500)');
      }
    }
  }
  if (oversizedCount === 0) ok('All files within line budget');

  // 6. No external network in shipped code (exclude test files; allow localhost MCP communication)
  console.log('\n6. No external network in shipped code:');
  const networkPatterns = [/fetch\(/, /XMLHttpRequest/, /WebSocket\(/, /new WebSocket/];
  let networkCount = 0;
  for (const pkg of pkgs) {
    const files = scanDirectory(resolve(ROOT, 'packages/' + pkg + '/src'));
    for (const file of files) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      const content = readFileSync(file, 'utf-8');
      for (const pattern of networkPatterns) {
        if (!pattern.test(content)) continue;
        // Check if it's localhost communication
        const isLocalhost = content.includes('localhost') || content.includes('127.0.0.1') || content.includes('mcpBaseUrl');
        if (!isLocalhost) {
          networkCount++;
          fail('Network pattern in ' + relative(ROOT, file));
        }
      }
    }
  }
  if (networkCount === 0) ok('No external network calls in shipped code');

  console.log('\n=== CONTEXT CHECK COMPLETE ===');
  if (!allPass) {
    console.error('\n❌ CONTEXT CHECK FAILED (' + failures.length + ' issues)');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  } else {
    console.log('\n✅ ALL CHECKS PASSED');
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
