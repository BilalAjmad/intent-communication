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
    # Replace "require("os").tmpdir() + "/.test-xxx" with require("os").tmpdir() + "/.test-xxx"
    content = re.sub(r'"require\("os"\)\.tmpdir\(\) \+ "/\.test-', 'require("os").tmpdir() + "/.test-', content)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f'Fixed {filepath}')

print('Done')
PYEOF