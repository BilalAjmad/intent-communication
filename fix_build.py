import json, glob, os

for pkg_path in glob.glob('packages/*/package.json'):
    with open(pkg_path, 'r') as f:
        pkg = json.load(f)
    
    if 'scripts' in pkg and 'build' in pkg['scripts']:
        build = pkg['scripts']['build']
        # Replace Windows copy with cross-platform node copy
        build = build.replace('copy dist\\esm\\index.js dist\\index.mjs', 'node -e "const fs=require(\'fs\');fs.copyFileSync(\'dist/esm/index.js\',\'dist/index.mjs\')"')
        build = build.replace('rmdir /s /q dist\\esm', 'node -e "const fs=require(\'fs\');fs.rmSync(\'dist/esm\',{recursive:true,force:true})"')
        pkg['scripts']['build'] = build
        with open(pkg_path, 'w') as f:
            json.dump(pkg, f, indent=2)
        print(f'Updated {pkg_path}: {build}')
PYEOF