/**
 * The single source of truth for the export token palette (trd 13.2).
 * `generateCssVariables()` textually derives :root/dark blocks from these
 * records; the RenderModel's `vars.light` / `vars.dark` reuse the same data.
 * No other module may duplicate these values.
 */

export const LIGHT_VARS: Record<string, string> = {
  "--intent-color-primary": "#0066cc",
  "--intent-color-primaryHover": "#0052a3",
  "--intent-color-secondary": "#6c757d",
  "--intent-color-background": "#ffffff",
  "--intent-color-surface": "#f8f9fa",
  "--intent-color-text-primary": "#212529",
  "--intent-color-text-secondary": "#6c757d",
  "--intent-color-border": "#dee2e6",
  "--intent-color-focus": "#0066cc",
  "--intent-color-error": "#dc3545",
  "--intent-color-success": "#28a745",
  "--intent-color-warning": "#ffc107",
  "--intent-spacing-xs": "4px",
  "--intent-spacing-sm": "8px",
  "--intent-spacing-md": "16px",
  "--intent-spacing-lg": "24px",
  "--intent-spacing-xl": "32px",
  "--intent-spacing-touchTarget": "44px",
  "--intent-typography-fontFamily-sans":
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  "--intent-typography-fontFamily-mono":
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  "--intent-typography-fontSize-xs": "12px",
  "--intent-typography-fontSize-sm": "14px",
  "--intent-typography-fontSize-md": "16px",
  "--intent-typography-fontSize-lg": "20px",
  "--intent-typography-fontSize-xl": "24px",
  "--intent-typography-fontWeight-normal": "400",
  "--intent-typography-fontWeight-medium": "500",
  "--intent-typography-fontWeight-bold": "700",
  "--intent-typography-lineHeight-tight": "1.25",
  "--intent-typography-lineHeight-normal": "1.5",
  "--intent-typography-lineHeight-relaxed": "1.75",
};

/** Dark overrides: only the keys that change in dark mode (trd 13.3). */
export const DARK_OVERRIDES: Record<string, string> = {
  "--intent-color-background": "#1a1a2e",
  "--intent-color-surface": "#16213e",
  "--intent-color-text-primary": "#eaeaea",
  "--intent-color-text-secondary": "#a0a0a0",
  "--intent-color-border": "#2a2a4a",
};

export const DARK_VARS: Record<string, string> = {
  ...LIGHT_VARS,
  ...DARK_OVERRIDES,
};

function colorSection(vars: Record<string, string>): string {
  return Object.entries(vars)
    .filter(([k]) => k.startsWith("--intent-color-"))
    .map(([k, v]) => `    ${k}: ${v};`)
    .join("\n");
}
function spacingSection(vars: Record<string, string>): string {
  return Object.entries(vars)
    .filter(([k]) => k.startsWith("--intent-spacing-"))
    .map(([k, v]) => `    ${k}: ${v};`)
    .join("\n");
}
function typographySection(vars: Record<string, string>): string {
  return Object.entries(vars)
    .filter(([k]) => k.startsWith("--intent-typography-"))
    .map(([k, v]) => `    ${k}: ${v};`)
    .join("\n");
}

/** The :root block text for the light palette. */
export function lightRootBlock(): string {
  return `  :root {
    /* Colors */
${colorSection(LIGHT_VARS)}

    /* Spacing */
${spacingSection(LIGHT_VARS)}

    /* Typography */
${typographySection(LIGHT_VARS)}
  }`;
}

/** The @media (prefers-color-scheme: dark) block text. */
export function darkMediaBlock(): string {
  return `  @media (prefers-color-scheme: dark) {
    :root {
${Object.entries(DARK_OVERRIDES).map(([k, v]) => `      ${k}: ${v};`).join("\n")}
    }
  }`;
}
