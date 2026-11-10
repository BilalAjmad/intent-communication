import fs from 'fs';

const content = fs.readFileSync('packages/linter/src/index.ts', 'utf8');
let openBraces = 0;
let inString = false;
let inTemplate = false;
let escapeNext = false;
for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (escapeNext) {
    escapeNext = false;
    continue;
  }
  if (char === '\\') {
    escapeNext = true;
    continue;
  }
  if (!inString && !inTemplate && char === '"') {
    inString = true;
  } else if (inString && char === '"' && !escapeNext) {
    inString = false;
  } else if (!inString && !inTemplate && char === '`') {
    inTemplate = true;
  } else if (inTemplate && char === '`') {
    inTemplate = false;
  } else if (!inString && !inTemplate) {
    if (char === '{') openBraces++;
    else if (char === '}') openBraces--;
  }
  if (openBraces < 0) {
    console.log('Negative brace count at position', i);
    break;
  }
  if (openBraces > 0 && i % 1000 === 0) {
    console.log(`Position ${i}: ${openBraces} open braces`);
  }
}
console.log('Final brace count:', openBraces);