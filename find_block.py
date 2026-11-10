with open(r'H:\intent communication\packages\schema\src\index.test.ts', 'r') as f:
    content = f.read()
start = content.find('describe("UUIDv7Schema", () => {')
if start != -1:
    end = content.find('  });', start)
    if end != -1:
        print(repr(content[start:end+4]))