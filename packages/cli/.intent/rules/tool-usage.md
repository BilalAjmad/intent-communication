# tool-usage.md

> Canonical rules for tool usage by agents in the Intent system.

## Available Tools

### get_scene
- **Purpose**: Retrieve scene data for context
- **Input**: `{ objectIds?, depth?, includeLocks?, maxBytes? }`
- **Output**: `{ scene?, summary?, objects?, locks?, truncated?, revision }`
- **Max bytes**: 32768 default
- **Usage**: Call at start of any task needing scene context

### apply_patch
- **Purpose**: Modify scene objects
- **Input**: `{ patch, force? }`
- **Patch ops**: `set`, `unset`, `insert`, `remove`, `move`, `replace`
- **Output**: `{ success, revision, conflict?, error? }`
- **Conflict**: Returned when `baseRevision !== scene.revision`

### get_feedback
- **Purpose**: Retrieve visual/behavioral feedback
- **Input**: `{ sceneId, objectIds?, includeImageData?, since? }`
- **Output**: `{ feedback[] }`

### ask_user
- **Purpose**: Ask interview questions
- **Input**: `{ questionId, kind, prompt, options?, min?, max?, step?, previousAnswer?, requiredTopics? }`
- **Kinds**: `start`, `choice`, `text`, `scale`, `confirm`, `skip`
- **Output**: `{ answer, meter, nextQuestion?, briefId?, delegated? }`

### open_studio
- **Purpose**: Launch Prototype Studio
- **Input**: `{ sceneId, userRequested?, quote? }`
- **Output**: `{ url, sessionId }`

### read_config
- **Purpose**: Read project configuration
- **Input**: `{ keys? }`
- **Output**: `{ config }`

## Tool Calling Rules

1. **One tool per turn** — Never batch multiple tool calls in a single response.
2. **Validate input** — Always parse with Zod schema before calling.
3. **Handle errors** — Catch `IntentError` and return structured error to user.
4. **Context budget** — Respect `maxBytes`; truncate if needed.
4. **Idempotency** — `get_scene` and `read_config` are idempotent; `apply_patch` is not.

## MCP Server

The MCP server exposes all 6 tools at `/mcp` endpoint. Tools are called via HTTP POST with `{ tool, input }`.

## Studio Integration

Studio connects via WebSocket to `/events` for real-time updates and calls MCP tools for mutations.