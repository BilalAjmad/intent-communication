/**
 * trd 13.7 — exact-match token → Tailwind utility class mapping. Anything
 * that doesn't match exactly stays as the CSS-var inline style it already is;
 * this module never guesses and never emits a class it cannot justify from
 * the profile's own maps.
 *
 * Maps (hex → color class prefix per property, px → spacing scale key per
 * property, hex/px → radius key). Keys in the maps come from
 * `intent scan` (tailwind.config literal theme extraction).
 *
 * Structural profile shape (kept local so @intent/engine does not depend on
 * the CLI package): whatever the scanner wrote to design-profile.json fits.
 */

export interface DesignProfileLike {
  tokens: {
    colors: Record<string, string>;
    spacing: Record<string, string>;
    radii: Record<string, string>;
  };
  components?: Array<{ role: string; importPath: string; exportName: string; propMap: Record<string, string>; confidence?: string }>;
}

export type ClassTarget = { prefix: string; prop: RegExp };

const COLOR_MAP: ClassTarget[] = [
  { prefix: "bg", prop: /^(background|backgroundColor|background-color)$/ },
  { prefix: "text", prop: /^color$/ },
  { prefix: "border", prop: /^(borderColor|border-color)$/ },
  { prefix: "outline", prop: /^(outlineColor|outline-color)$/ },
  { prefix: "fill", prop: /^fill$/ },
  { prefix: "stroke", prop: /^stroke$/ },
];

const SPACING_MAP: ClassTarget[] = [
  { prefix: "p", prop: /^padding$/ },
  { prefix: "px", prop: /^(padding-inline|paddingInline|padding-left|paddingLeft|padding-right|paddingRight)$/ },
  { prefix: "py", prop: /^(padding-block|paddingBlock|padding-top|paddingTop|padding-bottom|paddingBottom)$/ },
  { prefix: "m", prop: /^margin$/ },
  { prefix: "mx", prop: /^(margin-inline|marginInline|margin-left|marginLeft|margin-right|marginRight)$/ },
  { prefix: "my", prop: /^(margin-block|marginBlock|margin-top|marginTop|margin-bottom|marginBottom)$/ },
  { prefix: "gap", prop: /^(gap|row-gap|rowGap|column-gap|columnGap)$/ },
  { prefix: "w", prop: /^width$/ },
  { prefix: "h", prop: /^height$/ },
  { prefix: "min-w", prop: /^(minWidth|min-width)$/ },
  { prefix: "min-h", prop: /^(minHeight|min-height)$/ },
  { prefix: "max-w", prop: /^(maxWidth|max-width)$/ },
  { prefix: "max-h", prop: /^(maxHeight|max-height)$/ },
  { prefix: "top", prop: /^top$/ },
  { prefix: "left", prop: /^left$/ },
  { prefix: "right", prop: /^right$/ },
  { prefix: "bottom", prop: /^bottom$/ },
];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const PX = /^(\d+(?:\.\d+)?)px$/;

export interface ClassMapResult {
  /** Utility classes to merge into className (Tailwind-compatible names). */
  classes: string[];
  /** Style props whose values were mapped (already emitted as classes). */
  consumed: Set<string>;
}

function classNameFor(prefix: string, key: string): string {
  const sanitized = key.replace(/_/g, "-");
  return sanitized.includes(".") ? `${prefix}-[${sanitized}]` : `${prefix}-${sanitized}`;
}

/** Splits a node's style record into Tailwind classes (exact matches) + what remains inline. */
export function mapStyleToClasses(style: Record<string, string>, profile: DesignProfileLike | null | undefined): { classes: string[]; rest: Record<string, string> } {
  if (!profile) return { classes: [], rest: { ...style } };

  const colorByHex = new Map<string, string>();
  for (const [key, value] of Object.entries(profile.tokens.colors ?? {})) {
    if (HEX.test(value)) colorByHex.set(value.toLowerCase(), key);
  }
  const spacingByPx = new Map<string, string>();
  for (const [key, value] of Object.entries(profile.tokens.spacing ?? {})) {
    const match = PX.exec(value.trim());
    if (match) spacingByPx.set(`${match[1]}px`, key);
  }
  const radiiByPx = new Map<string, string>();
  for (const [key, value] of Object.entries(profile.tokens.radii ?? {})) {
    const match = PX.exec(value.trim());
    if (match) radiiByPx.set(`${match[1]}px`, key);
  }

  const classes: string[] = [];
  const rest: Record<string, string> = {};
  for (const [prop, value] of Object.entries(style)) {
    let mapped = false;
    for (const { prefix, prop: regex } of COLOR_MAP) {
      if (!regex.test(prop)) continue;
      const hex = value.trim().toLowerCase();
      const key = colorByHex.get(hex);
      if (key) {
        classes.push(classNameFor(prefix, key));
        mapped = true;
      }
      break;
    }
    if (!mapped) {
      for (const { prefix, prop: regex } of SPACING_MAP) {
        if (!regex.test(prop)) continue;
        const match = PX.exec(value.trim());
        const key = match ? spacingByPx.get(`${match[1]}px`) : undefined;
        if (key) {
          classes.push(classNameFor(prefix, key));
          mapped = true;
        }
        break;
      }
    }
    if (!mapped && /^(borderRadius|border-radius)$/.test(prop)) {
      const match = PX.exec(value.trim());
      const key = match ? radiiByPx.get(`${match[1]}px`) : undefined;
      if (key) {
        classes.push(classNameFor("rounded", key));
        mapped = true;
      }
    }
    if (!mapped) rest[prop] = value;
  }
  return { classes, rest };
}
