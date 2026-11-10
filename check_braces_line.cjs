const fs = require('fs');
const content = fs.readFileSync('packages/linter/src/index.ts', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const openBraces = (line.match(/{/g) || []).length;
  const closeBraces = (line.match(/}/g) || []).length;
  
  if (line.match(/^function \w+\(/)) {
    console.log('Function start at line', i+1, lines[i].trim());
  }
  
  if (openBraces > 0 || closeBraces > 0) {
    console.log('Line', i+1, 'open:', openBraces, 'close:', closeBraces, lines[i].trim().substring(0, 80));
  }
}