import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(__dirname, '..');
const DOCS_DIR = resolve(ROOT, 'docs');

function extractHeadings(content) {
  const regex = /^(#{1,3})\s+(.+)$/gm;
  const sections = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const level = match[1].length;
    const heading = match[2].trim();
    const number = heading.match(/^(\d+(?:\.\d+)*)/)?.[1] || '';
    if (number) {
      sections.push({ number, heading });
    }
  }
  return sections;
}

function getDocEntries() {
  const entries = [];
  const files = readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));

  for (const file of files) {
    const path = join(DOCS_DIR, file);
    const content = readFileSync(path, 'utf-8');
    const title = file.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const sections = extractHeadings(content);
    entries.push({
      path: file,
      title,
      sections
    });
  }

  entries.sort((a, b) => {
    if (a.path === 'plan.md') return -1;
    if (b.path === 'plan.md') return 1;
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });

  return entries;
}

function generateIndex() {
  const entries = getDocEntries();
  let md = '# Documentation Index\n\n';

  for (const entry of entries) {
    md += `## ${entry.title}\n\n`;
    md += `- Path: \`docs/${entry.path}\`\n`;
    if (entry.sections.length > 0) {
      md += '- Sections:\n';
      for (const s of entry.sections) {
        md += `  - ${s.number} ${s.heading}\n`;
      }
    }
    md += '\n';
  }

  return md;
}

const indexPath = resolve(ROOT, 'docs', 'INDEX.md');
const index = generateIndex();
const existing = existsSync(resolve(ROOT, 'docs', 'INDEX.md')) ? readFileSync(resolve(ROOT, 'docs', 'INDEX.md'), 'utf-8') : '';

if (index !== existing) {
  writeFileSync(resolve(ROOT, 'docs', 'INDEX.md'), index);
  console.log('Updated docs/INDEX.md');
} else {
  console.log('docs/INDEX.md is up to date');
}

// Parse S-1-01..S-1-15 step headings from plan.md section 8.3 only
const planPath = resolve(ROOT, 'docs', 'plan.md');
const planContent = readFileSync(planPath, 'utf-8');

// Find section 8.3 and extract S-1 step headings within it
const section83Match = planContent.match(/### 8\.3 Steps([\s\S]*?)(?=### 8\.4|## 9|# )/);
const section83Content = section83Match ? section83Match[1] : planContent;

// Match S-1-XX step headings (bold format: **S-1-01 schema.** or S-1-01 schema.)
const stepRegex = /\*\*S-1-(\d{2})\s+([^\n*]+?)\*\*|S-1-(\d{2})\s+([^\n*]+?)(?:\.|\n|$)/g;
const steps = [];
const seen = new Set();
let match;
while ((match = stepRegex.exec(section83Content)) !== null) {
  const num = match[1] || match[3];
  const title = (match[2] || match[4] || '').trim().replace(/\.$/, '');
  if (num && title && !seen.has(num)) {
    seen.add(num);
    steps.push({ num, title });
  }
}

steps.sort((a, b) => (a.num < b.num ? -1 : a.num > b.num ? 1 : 0));

console.log(`Found ${steps.length} S-1 steps in plan.md section 8.3:`);
for (const step of steps) {
  console.log('  S-1-' + step.num + ': ' + step.title);
}

if (steps.length !== 15) {
  console.error(`ERROR: Expected 15 S-1 steps, found ${steps.length}`);
  process.exit(1);
}
