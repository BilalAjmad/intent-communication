import re

files = [
    'packages/core/src/index.test.ts',
    'packages/adapters-node/src/index.test.ts',
    'packages/server/src/index.test.ts',
    'packages/skills/src/index.test.ts',
    'packages/cli/src/index.test.ts',
    'packages/mcp-server/src/index.test.ts',
]

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    # Fix the string-wrapped require calls
    content = content.replace('"require(\\"os\\").tmpdir() + "/.test-', 'require("os").tmpdir() + "/.test-')
    with open(filepath, 'w') as f:
        f.write(content)
    print(f'Fixed {filepath}')

print('Done')
PYEOF