content = open(r'H:\folderrr\docs\pr.md', 'r', encoding='utf-8').read()
# The content is already in the file, but let's write a fresh copy
# We'll write it in chunks to avoid escaping issues
print("File length:", len(content))