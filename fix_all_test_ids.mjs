import fs from 'fs';

const validIds = {
  '018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5a': 's_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  '018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5b': 'o_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  '018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5c': 'o_02ARZ3NDEKTSV4RRFFQ69G5FAV',
  '018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d': 'o_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  '018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5d': 'o_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  '018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5e': 'o_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  '018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5e': 'o_01ARZ3NDEKTSV4RRFFQ69G5FAV',
  '018f0a1b-2c3d-7e5f-8a9b-0c1d2e3f4a5f': 'o_01ARZ3NDEKTSV4RRFFQ69G5FAV',
};

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  for (const [oldId, newId] of Object.entries(validIds)) {
    const escapedOld = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    content = content.replace(new RegExp(escapedOld, 'g'), newId);
  }
  
  content = content.replace("UUIDv7Schema,", "CrockfordULIDSchema,");
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed ' + filePath);
}

const testFiles = [
  'packages/linter/src/index.test.ts',
  'packages/adapters-node/src/index.test.ts',
  'packages/engine/src/index.test.ts',
  'packages/mcp-server/src/index.test.ts',
  'packages/server/src/index.test.ts',
  'packages/cli/src/index.test.ts',
  'packages/studio/src/index.test.ts',
];

for (const file of testFiles) {
  try {
    fixFile(file);
  } catch (e) {
    console.log('Skipping ' + file + ': ' + e.message);
  }
}

console.log('Done fixing test files');