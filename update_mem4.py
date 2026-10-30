import re

with open('H:/folderrr/docs/memory.md', 'r', encoding='utf-8') as f:
    content = f.read()

# 4. Add Waiver WV-001 after the Waiver Register section
waiver_section = r'(## 10\. Waiver Register.*?\| ID \| Waiver \| Date \| Covers \| Status \|)'
new_waiver = r'''\1
| WV-001 | Step R one-by-one rulings waived | 2026-10-30 | R-B33, R-B34, R-B37, R-B38, R-B39, PL-10, loop L4, PR3 | Applied |

'''

content = re.sub(waiver_section, new_waiver, content, flags=re.DOTALL)

# 5. Update Verified Facts (VF-001 to VF-012)
vf_updates = {
    'VF-001': '| VF-001 | Node LTS lines and `fs.watch` / `fs.rename` behavior per OS | Node.js 22/24/26 LTS; v22.22+ recommended; fs.watch recursive: Linux no, macOS yes, Windows yes; fs.rename over existing on Windows throws EPERM | 2026-10-29 | https://nodejs.org/en/about/previous-releases, https://nodejs.org/api/fs.html, https://github.com/nodejs/node/pull/22014 | Verified |',
    'VF-002': '| VF-002 | MCP specification revision, stdio, tool result format, elicitation support | Spec 2025-11-25; stdio transport; tool result with content[] and isError; elicitation (form+URL), prompts, resources exist; @modelcontextprotocol/sdk v1.32.2 (v1.x) + v2 stable | 2026-10-29 | https://modelcontextprotocol.io/specification/2025-11-25, https://www.npmjs.com/package/@modelcontextprotocol/sdk | Verified |',
    'VF-003': '| VF-003 | Claude Code: MCP config path and syntax, rules and skills loading (XQ2) | Project: `.mcp.json`; User: `~/.claude/settings.json`; CLAUDE.md always loaded; skills (SKILL.md) lazy-load on demand; plan mode = read-only; /compact visible | 2026-10-29 | https://docs.anthropic.com/en/docs/claude-code/mcp, https://docs.anthropic.com/en/docs/claude-code/skills, https://docs.anthropic.com/en/docs/claude-code/commands | Verified |',
    'VF-004': '| VF-004 | Cursor: MCP config path and syntax, rule types (XQ3) | Project: `.cursor/mcp.json`; 4 rule types: Always, Auto-attached (glob), Agent-requested (description), Manual; `.mdc` format in `.cursor/rules/` | 2026-10-29 | https://docs.cursor.com/context/model-context-protocol, https://docs.cursor.com/context/rules | Verified |',
    'VF-005': '| VF-005 | Cline, Codex, Windsurf, Copilot: config and rules formats | Cline: `~/.cline/data/settings/cline_mcp_settings.json` + `.clinerules`; Codex/Windsurf/Copilot: UNVERIFIED (no official docs accessed) | 2026-10-29 | https://docs.cline.bot/mcp/mcp-overview, https://docs.cline.bot/customization/cline-rules | Partial |',
    'VF-006': '| VF-006 | Zod major version and syntax | v4 (4.6.7); discriminated unions: `z.discriminatedUnion()`; recursive: `z.lazy()` or `z.recursive()` | 2026-10-29 | https://www.npmjs.com/package/zod, https://zod.dev | Verified |',
    'VF-007': '| VF-007 | React, Vite, Zustand, Immer, Radix, Moveable, perfect-freehand versions and compatibility | React 19.3.1, Vite 8.3.5, Zustand 5.0.16, Immer 11.2.9, @radix-ui/themes 3.3.0, Moveable 0.53.0 (3 yr old), perfect-freehand 1.2.3; Moveable/React 19 UNVERIFIED | 2026-10-29 | https://www.npmjs.com/package/react, /vite, /zustand, /immer, /@radix-ui/themes, /moveable, /perfect-freehand | Partial |',
    'VF-008': '| VF-008 | File watcher library (AQ1) | chokidar 6.0.0; cross-platform recursive; Node.js 22+; native backend macOS/Windows, polling Linux | 2026-10-29 | https://www.npmjs.com/package/chokidar | Verified |',
    'VF-009': '| VF-009 | Playwright version, browser pinning, fonts in CI | UNVERIFIED - npm page 403 Forbidden | 2026-10-29 | UNVERIFIED | UNVERIFIED |',
    'VF-010': '| VF-010 | npm availability of `intent-studio` (OQ1) | Available (404 on npmjs.com) | 2026-10-29 | https://www.npmjs.com/package/intent-studio | Verified |',
    'VF-011': '| VF-011 | Whether MCP prompts or resources can deliver on-request rules (XQ4) | MCP prompts/resources exist; prompts=reusable templates, resources=read-only data; could deliver rules but requires server support; recommend keeping `.intent/rules/` fallback | 2026-10-29 | https://modelcontextprotocol.io/specification/2025-06-18/server/prompts, /resources | Verified |',
    'VF-012': '| VF-012 | SVG sanitizer library (TQ4) | isomorphic-dompurify 4.6.0 (wraps DOMPurify); Node.js 22.22.2+/24.15.0+/26.0.0+; DOMPurify Apache 2.0/MPL 2.0 | 2026-10-29 | https://www.npmjs.com/package/isomorphic-dompurify | Verified |',
}

for vf_id, vf_row in vf_updates.items():
    pattern = rf'\| {vf_id} \| [^|]+ \| [^|]+ \| [^|]+ \| [^|]+ \| [^|]+ \|'
    content = re.sub(pattern, vf_row, content)

with open('H:/folderrr/docs/memory.md', 'w', encoding='utf-8') as f:
    f.write(content)

print("Waiver and Verified Facts updated")