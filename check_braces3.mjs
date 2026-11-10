import fs from 'fs';

const content = fs.readFileSync('packages/linter/src/index.ts', 'utf8');
let openBraces = 0;
let inString = false;
let inTemplate = false;
let escapeNext = false;
const braceStack = [];

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  if (char === '\\') {
    escapeNext = true;
    continue;
  }
  if (escapeNext) {
    escapeNext = false;
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
    if (char === '{') {
      braceStack.push({ pos: i, count: openBraces + 1 });
      openBraces++;
    } else if (char === '}') {
      if (openBraces > 0) {
        openBraces--;
        const last = braceStack.pop();
        if (openBraces < 0) {
          console.log('Negative at', i);
        }
      }
    }
  }
}
console.log('Final brace count:', openBraces);
if (openBraces > 0) {
  console.log('Stack:', braceStack.map(b => ({pos: b.pos, count: b.count})));
}