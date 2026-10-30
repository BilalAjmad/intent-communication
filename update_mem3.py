import re

with open('H:/folderrr/docs/memory.md', 'r', encoding='utf-8') as f:
    content = f.read()

# 3. Update all Amendment Register statuses from "Pending" to "Applied"
# Architecture amendments (C1-C9)
content = re.sub(r'\| (C[1-9]) \| ([^|]+) \| ([^|]+) \| (accept|decide|info) \| Pending \|', 
                 r'| \1 | \2 | \3 | \4 | Applied |', content)

# TRD amendments (T1-T12)
content = re.sub(r'\| (T(?:1[0-2]|[1-9])) \| ([^|]+) \| ([^|]+) \| (accept|decide|info) \| Pending \|', 
                 r'| \1 | \2 | \3 | \4 | Applied |', content)

# Rules amendments (C-R1 to C-R6)
content = re.sub(r'\| (C-R[1-6]) \| ([^|]+) \| ([^|]+) \| (accept|decide|info) \| Pending \|', 
                 r'| \1 | \2 | \3 | \4 | Applied |', content)

# Context amendments (C-X1 to C-X8)
content = re.sub(r'\| (C-X[1-8]) \| ([^|]+) \| ([^|]+) \| (accept|decide|info) \| Pending \|', 
                 r'| \1 | \2 | \3 | \4 | Applied |', content)

# Intent amendments (I1-I11)
content = re.sub(r'\| (I(?:1[0-1]|[1-9])) \| ([^|]+) \| ([^|]+) \| (accept|decide|info) \| Pending \|', 
                 r'| \1 | \2 | \3 | \4 | Applied |', content)

# Plan amendments (P1-P13)
content = re.sub(r'\| (P(?:1[0-3]|[1-9])) \| ([^|]+) \| ([^|]+) \| (accept|decide|info) \| Pending \|', 
                 r'| \1 | \2 | \3 | \4 | Applied |', content)

# Test amendments (TS1-TS12)
content = re.sub(r'\| (TS(?:1[0-2]|[1-9])) \| ([^|]+) \| ([^|]+) \| (accept|decide|info) \| Pending \|', 
                 r'| \1 | \2 | \3 | \4 | Applied |', content)

# Loop amendments (L1-L11)
content = re.sub(r'\| (L(?:1[0-1]|[1-9])) \| ([^|]+) \| ([^|]+) \| (accept|decide|info) \| Pending \|', 
                 r'| \1 | \2 | \3 | \4 | Applied |', content)

# Review amendments (V1-V12)
content = re.sub(r'\| (V(?:1[0-2]|[1-9])) \| ([^|]+) \| ([^|]+) \| (accept|decide|info) \| Pending \|', 
                 r'| \1 | \2 | \3 | \4 | Applied |', content)

# PR amendments (PR1-PR10)
content = re.sub(r'\| (PR(?:10|[1-9])) \| ([^|]+) \| ([^|]+) \| (accept|decide|info) \| Pending \|', 
                 r'| \1 | \2 | \3 | \4 | Applied |', content)

# Memory amendments (M1-M5)
content = re.sub(r'\| (M[1-5]) \| ([^|]+) \| ([^|]+) \| (accept|decide|info) \| Pending \|', 
                 r'| \1 | \2 | \3 | \4 | Applied |', content)

with open('H:/folderrr/docs/memory.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("Amendment registers updated")