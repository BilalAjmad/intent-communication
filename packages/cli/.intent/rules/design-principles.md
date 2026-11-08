# design-principles.md

> Canonical design principles for the Intent system — derived from design.md and enforced by linter.

## Token System

All visual values MUST use tokens. No hardcoded colors, spacing, or typography.

### Color Tokens
```
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
```

### Spacing Tokens
```
token.spacing.xs   # 4px
token.spacing.sm   # 8px
token.spacing.md   # 16px
token.spacing.lg   # 24px
token.spacing.xl   # 32px
token.spacing.touchTarget  # 44px (minimum touch target)
```

### Typography Tokens
```
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
```

## Component Rules

### Buttons
- Min 44×44px touch target
- `:hover`, `:focus-visible`, `:disabled` states required
- Variants: primary, secondary, outline, ghost, destructive

### Inputs
- Min 44px height
- `:focus-visible` with 2px focus ring
- `:disabled` state

### Images
- `alt` text required
- `fit`: cover | contain | fill | scale-down | none

### Containers
- Flex or Grid layout
- `direction` required for flex
- `gap`, `padding` use spacing tokens

## Accessibility (WCAG AA)

- Color contrast: 4.5:1 for text, 3:1 for UI elements
- Focus visible on all interactive elements
- Semantic HTML structure
- Alt text for images
- ARIA labels where needed

## Motion

- Respect `prefers-reduced-motion`
- Default: reduced motion
- Transitions: 150ms ease-out

## Responsive

- Mobile-first breakpoints
- Fluid typography with `clamp()`
- Touch targets 44px minimum