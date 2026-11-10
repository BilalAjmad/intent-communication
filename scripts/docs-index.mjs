import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(__dirname, '..');
const DOCS_DIR = resolve(ROOT, 'docs');

interface DocEntry {
  path: string;
  title: string;
  sections: { number: string; heading: string }[];
}

function extractHeadings(content: string): { number: string; heading: string }[] {
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

function getDocEntries(): DocEntry[] {
  const entries: DocEntry[] = [];
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
  
  // Sort: plan.md first, then alphabetical
  entries.sort((a, b) => {
    if (a.path === 'plan.md') return -1;
    if (b.path === 'plan.md') return 1;
    return a.path.localeCompare(b.path);
  });
  
  return entries;
}

function generateIndex() {
  const entries = getDocEntries();
  let md = '# Documentation Index\n\n';
  md += `Generated: ${new Date().toISOString()}\n\n`;
  
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

const planPath = resolve(ROOT, 'docs', 'plan.md');
const planContent = readFileSync(resolve(ROOT, 'docs', 'plan.md'), 'utf-8');

// Check S-1-01..S-1-15 steps
const stepRegex = /### S-1-(\d{2})\s+(.+)/g;
const steps = [];
let match;
while ((match = /### S-1-(\d{2})\s+(.+)/g.exec(readFileSync(resolve(ROOT, 'docs', 'plan.md'), 'utf-8'))) !== null) {
  steps.push({ num: match[1], title: match[1].trim() });
}

console.log(`Found ${steps.length} S-1 steps:`);
for (const step of steps) {
  console.log(`  S-1-${step.num}: ${step.title}`);
}