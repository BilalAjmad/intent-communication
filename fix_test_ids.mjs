import fs from 'fs';

const filePath = 'packages/core/src/index.test.ts';
let content = fs.readFileSync(filePath, 'utf-8');

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

for (const [oldId, newId] of Object.entries(validIds)) {
  const escapedOld = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  content = content.replace(new RegExp(escapedOld, 'g'), newId);
}

content = content.replace("UUIDv7Schema,", "CrockfordULIDSchema,");

fs.writeFileSync(filePath, content);
console.log('Updated core test file');