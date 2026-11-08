import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface SkillFile {
  name: string;
  content: string;
  description: string;
}

export interface SkillGeneratorOptions {
  projectRoot: string;
  outputDir?: string;
}

const INTENT_CORE_MD = `# intent-core.md

> Canonical rules for the Intent Core agent — always-active interviewer that drives the project brief.

## Role

You are the **Intent Core** agent. Your job is to run the interview specified in \`intent.md\`, derive the profile, and produce a \`brief.json\` that the Prototype Studio can consume.

## Operating Principles

1. **Always active** — You run continuously in the background, not just on command.
2. **Meter-driven** — Every answer advances the meter (0–100%). The interview completes at 100% with all required topics covered.
3. **Profile derivation** — Answers map to \`profile.json\` preferences and patterns per \`intent.md\` §7.
4. **Brief emission** — On completion, emit \`brief.json\` per \`intent.md\` §8.
5. **Delegation** — If the user delegates, hand off to Studio with a quote.

## Interview Flow

1. **Start** — Ask \`kind: "start"\` question to confirm project intent.
2. **Required topics** — Iterate through \`requiredTopics\` from \`intent.md\` §6 (layout, colors, typography, interactions, content, accessibility, responsive).
3. **Question kinds** — Use \`choice\`, \`text\`, \`scale\`, \`confirm\`, \`skip\` as appropriate.
4. **Meter update** — After each answer, compute meter = (answeredRequired / totalRequired) × 89 + (optionalBonus up to 11%).
5. **Completion** — At 100% with all required topics, emit \`brief.json\` and set \`status: "complete"\`.

## Question Bank

The question bank lives in \`interview-bank.md\` (120 lines, on-request canonical file). Load it when the interview starts.

## Profile Mapping

| Answer | Profile Field |
|--------|---------------|
| Color choices | \`preferences.tokens.color.*\` |
| Spacing choices | \`preferences.tokens.spacing.*\` |
| Typography choices | \`preferences.tokens.typography.*\` |
| Density preference | \`preferences.density\` |
| Motion preference | \`preferences.motion\` |
| Pattern recognition | \`patterns[]\` (reuse detected) |

## Brief Schema

See \`@intent/schema\` → \`BriefSchema\`. Required fields: \`title\`, \`summary\`, \`goals[]\`, \`constraints[]\`, \`designDirection\`, \`technicalRequirements[]\`, \`outOfScope[]\`.

## Delegation

When \`delegated: true\`, include a \`quote\` (user's own words) and call \`open_studio\` with that quote.

## Error Handling

- Invalid answer → re-ask with clarification
- Network error → retry with exponential backoff
- Profile write failure → log and continue`;

const TOOL_USAGE_MD = `# tool-usage.md

> Canonical rules for tool usage by agents in the Intent system.

## Available Tools

### get_scene
- **Purpose**: Retrieve scene data for context
- **Input**: \`{ objectIds?, depth?, includeLocks?, maxBytes? }\`
- **Output**: \`{ scene?, summary?, objects?, locks?, truncated?, revision }\`
- **Max bytes**: 32768 default
- **Usage**: Call at start of any task needing scene context

### apply_patch
- **Purpose**: Modify scene objects
- **Input**: \`{ patch, force? }\`
- **Patch ops**: \`set\`, \`unset\`, \`insert\`, \`remove\`, \`move\`, \`replace\`
- **Output**: \`{ success, revision, conflict?, error? }\`
- **Conflict**: Returned when \`baseRevision !== scene.revision\`

### get_feedback
- **Purpose**: Retrieve visual/behavioral feedback
- **Input**: \`{ sceneId, objectIds?, includeImageData?, since? }\`
- **Output**: \`{ feedback[] }\`

### ask_user
- **Purpose**: Ask interview questions
- **Input**: \`{ questionId, kind, prompt, options?, min?, max?, step?, previousAnswer?, requiredTopics? }\`
- **Kinds**: \`start\`, \`choice\`, \`text\`, \`scale\`, \`confirm\`, \`skip\`
- **Output**: \`{ answer, meter, nextQuestion?, briefId?, delegated? }\`

### open_studio
- **Purpose**: Launch Prototype Studio
- **Input**: \`{ sceneId, userRequested?, quote? }\`
- **Output**: \`{ url, sessionId }\`

### read_config
- **Purpose**: Read project configuration
- **Input**: \`{ keys? }\`
- **Output**: \`{ config }\`

## Tool Calling Rules

1. **One tool per turn** — Never batch multiple tool calls in a single response.
2. **Validate input** — Always parse with Zod schema before calling.
3. **Handle errors** — Catch \`IntentError\` and return structured error to user.
4. **Context budget** — Respect \`maxBytes\`; truncate if needed.
4. **Idempotency** — \`get_scene\` and \`read_config\` are idempotent; \`apply_patch\` is not.

## MCP Server

The MCP server exposes all 6 tools at \`/mcp\` endpoint. Tools are called via HTTP POST with \`{ tool, input }\`.

## Studio Integration

Studio connects via WebSocket to \`/events\` for real-time updates and calls MCP tools for mutations.`;

const DESIGN_PRINCIPLES_MD = `# design-principles.md

> Canonical design principles for the Intent system — derived from design.md and enforced by linter.

## Token System

All visual values MUST use tokens. No hardcoded colors, spacing, or typography.

### Color Tokens
\`\`\`
token.color.primary              # Primary brand color
token.color.primaryHover         # Hover state
token.color.secondary            # Secondary actions
token.color.background           # Page background
token.color.surface              # Card/surface background
token.color.text.primary         # Primary text
token.color.text.secondary       # Secondary text
token.color.border               # Borders
token.color.focus                # Focus ring
token.color.error                # Error states
token.color.success              # Success states
token.color.warning              # Warning states
\`\`\`

### Spacing Tokens
\`\`\`
token.spacing.xs   # 4px
token.spacing.sm   # 8px
token.spacing.md   # 16px
token.spacing.lg   # 24px
token.spacing.xl   # 32px
token.spacing.touchTarget  # 44px (minimum touch target)
\`\`\`

### Typography Tokens
\`\`\`
token.typography.fontFamily.sans   # System UI stack
token.typography.fontFamily.mono   # Monospace stack
token.typography.fontSize.xs       # 12px
token.typography.fontSize.sm       # 14px
token.typography.fontSize.md       # 16px
token.typography.fontSize.lg       # 20px
token.typography.fontSize.xl       # 24px
token.typography.fontWeight.normal # 400
token.typography.fontWeight.medium # 500
token.typography.fontWeight.bold   # 700
token.typography.lineHeight.tight  # 1.25
token.typography.lineHeight.normal # 1.5
token.typography.lineHeight.relaxed # 1.75
\`\`\`

## Component Rules

### Buttons
- Min 44×44px touch target
- \`:hover\`, \`:focus-visible\`, \`:disabled\` states required
- Variants: primary, secondary, outline, ghost, destructive

### Inputs
- Min 44px height
- \`:focus-visible\` with 2px focus ring
- \`:disabled\` state

### Images
- \`alt\` text required
- \`fit\`: cover | contain | fill | scale-down | none

### Containers
- Flex or Grid layout
- \`direction\` required for flex
- \`gap\`, \`padding\` use spacing tokens

## Accessibility (WCAG AA)

- Color contrast: 4.5:1 for text, 3:1 for UI elements
- Focus visible on all interactive elements
- Semantic HTML structure
- Alt text for images
- ARIA labels where needed

## Motion

- Respect \`prefers-reduced-motion\`
- Default: reduced motion
- Transitions: 150ms ease-out

## Responsive

- Mobile-first breakpoints
- Fluid typography with \`clamp()\`
- Touch targets 44px minimum`;

const STUDIO_MD = `# studio.md

> Canonical rules for the Prototype Studio agent — command-only visual editor.

## Role

You are the **Prototype Studio** agent. You run only on explicit user command (\`open_studio\` tool). You provide a visual editor for the scene rendered in an iframe.

## Architecture

- **SPA Shell** — React/Vite app served on \`studioPort\`
- **Preview Iframe** — Scene rendered via \`@intent/engine\` on \`previewPort\`
- **Tool Bar** — Left sidebar with tools (select, rectangle, text, button, image, container)
- **Inspector** — Right sidebar for selected object properties
- **Layer Panel** — Bottom panel showing object tree

## Communication

- **MCP Tools** — All mutations via \`apply_patch\`, \`get_scene\`, \`get_feedback\`
- **SSE** — Real-time updates via \`/events?scene=<id>\`
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

- Iframe loads \`/preview?scene=<id>\`
- Sandbox: \`allow-scripts allow-same-origin\`
- CSP: \`frame-ancestors 'self'\`
- Auto-refresh on SSE \`revision\` events

## Export

- **HTML** — \`exportToHtml(scene)\` from \`@intent/engine\`
- **Download** — Blob with \`application/html\`
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
- Validation errors → inline in inspector`;

export const SKILL_FILES: SkillFile[] = [
  { name: "intent-core.md", content: INTENT_CORE_MD, description: "Intent Core agent rules" },
  { name: "tool-usage.md", content: TOOL_USAGE_MD, description: "Tool usage rules for agents" },
  { name: "design-principles.md", content: DESIGN_PRINCIPLES_MD, description: "Design principles from design.md" },
  { name: "studio.md", content: STUDIO_MD, description: "Prototype Studio agent rules" },
];

export async function generateSkillFiles(options: SkillGeneratorOptions): Promise<void> {
  const outputDir = options.outputDir || resolve(options.projectRoot, ".intent", "rules");
  await fs.mkdir(outputDir, { recursive: true });

  for (const file of SKILL_FILES) {
    const filePath = resolve(outputDir, file.name);
    await fs.writeFile(filePath, file.content, "utf-8");
  }
}

export async function generateAllSkillFiles(projectRoot: string): Promise<void> {
  await generateSkillFiles({ projectRoot });
}

export { INTENT_CORE_MD, TOOL_USAGE_MD, DESIGN_PRINCIPLES_MD, STUDIO_MD };