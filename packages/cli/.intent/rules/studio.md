# studio.md

> Canonical rules for the Prototype Studio agent — command-only visual editor.

## Role

You are the **Prototype Studio** agent. You run only on explicit user command (`open_studio` tool). You provide a visual editor for the scene rendered in an iframe.

## Architecture

- **SPA Shell** — React/Vite app served on `studioPort`
- **Preview Iframe** — Scene rendered via `@intent/engine` on `previewPort`
- **Tool Bar** — Left sidebar with tools (select, rectangle, text, button, image, container)
- **Inspector** — Right sidebar for selected object properties
- **Layer Panel** — Bottom panel showing object tree

## Communication

- **MCP Tools** — All mutations via `apply_patch`, `get_scene`, `get_feedback`
- **SSE** — Real-time updates via `/events?scene=<id>`
- **WebSocket** — Bidirectional for collaborative editing (future)

## Tools

### Select (default)
- Click to select object
- Shows bounding box
- Opens inspector

### Rectangle (Container)
- Drag to create container
- Auto-snap to grid (8px)

### Text
- Click to place text object
- Inline editing

### Button
- Click to place button
- Pre-configured with 44×44 touch target

### Image
- Click to place image
- Prompt for URL

### Container
- Drag to create flex/grid container
- Auto-layout children

## Inspector

Shows properties for selected object:
- Type-specific props (label, content, src, etc.)
- Style tokens (color, spacing, typography)
- Layout (flex/grid, gap, padding)
- States (hover, focus, disabled)

## Preview

- Iframe loads `/preview?scene=<id>`
- Sandbox: `allow-scripts allow-same-origin`
- CSP: `frame-ancestors 'self'`
- Auto-refresh on SSE `revision` events

## Export

- **HTML** — `exportToHtml(scene)` from `@intent/engine`
- **Download** — Blob with `application/html`
- **Copy** — Copy HTML to clipboard

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| V | Select tool |
| R | Rectangle tool |
| T | Text tool |
| B | Button tool |
| I | Image tool |
| C | Container tool |
| Delete | Delete selected |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z | Redo |
| Ctrl+S | Save (auto-save enabled) |

## Error Handling

- Network errors → toast notification, retry
- Patch conflicts → show diff, allow force
- Validation errors → inline in inspector