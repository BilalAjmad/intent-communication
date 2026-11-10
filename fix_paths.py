import re

files = {
    'packages/core/src/index.test.ts': 'H:\\\\intent-communication\\\\.test-intent',
    'packages/adapters-node/src/index.test.ts': 'H:\\\\intent-communication\\\\.test-intent-adapters',
    'packages/server/src/index.test.ts': 'H:\\\\intent-communication\\\\.test-server',
    'packages/skills/src/index.test.ts': 'H:\\\\intent-communication\\\\.test-skills',
    'packages/cli/src/index.test.ts': 'H:\\\\intent-communication\\\\.test-cli',
    'packages/mcp-server/src/index.test.ts': 'H:\\\\intent-communication\\\\.test-mcp',
}

for filepath, old_path in files.items():
    with open(filepath, 'r') as f:
        content = f.read()
    new_path = 'require("os").tmpdir() + "/.test-' + old_path.split('.test-')[1]
    content = content.replace(old_path, new_path)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f'Fixed {filepath}')

print('Done')
PYEOF