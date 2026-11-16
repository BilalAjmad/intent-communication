/**
 * trd 16 — the Scanner and `design-profile.json`. Static analysis only:
 * NOTHING the user wrote is ever executed. JavaScript/TypeScript config files
 * are parsed with the TypeScript AST; any non-literal expression ends up in
 * `unresolved` with a reason, never guessed and never evaluated.
 *
 * Determinism (trd 16.2): sources and tokens are sorted; `generatedAt` is the
 * NEWEST source mtime, not the clock (the mapping itself is a pure function of
 * the sources). Unknown formats are ignored, not approximated.
 */
import { promises as fs } from "node:fs";
import { join, resolve, sep } from "node:path";
import { writeAtomic } from "@intent/core";
import {
  DesignProfileSchema,
  type DesignProfile,
  type DesignSource,
  type UnresolvedEntry,
  type ScanResult,
} from "./scan-profile.js";
import { relOf, walkFiles, newestMtime, readUnderLimit } from "./scan-fs.js";
import { parseStaticConfig } from "./scan-ast.js";
import { pxTo, flattenLiterals, flattenW3cTokens, assignW3cTokens } from "./scan-tokens.js";

export {
  DesignProfileSchema,
  type DesignProfile,
  type DesignSource,
  type UnresolvedEntry,
  type ScanResult,
} from "./scan-profile.js";

interface Ctx {
  projectRoot: string;
  sources: DesignSource[];
  unresolved: UnresolvedEntry[];
  tokens: DesignProfile["tokens"];
  tailwind: NonNullable<DesignProfile["tailwind"]>;
  sourceFiles: string[];
}

function pushSource(ctx: Ctx, source: DesignSource): void {
  ctx.sources.push(source);
}

function mergeFlat(target: Record<string, string>, flat: Record<string, string>): void {
  for (const [key, value] of Object.entries(flat)) {
    if (key.startsWith("$")) continue;
    target[key] = value;
  }
}

/** Tailwind theme (extend wins over plain), colors/spacing/radii/fonts, plus the hex/px maps. */
function absorbTailwindTheme(ctx: Ctx, theme: Record<string, unknown>, rel: string): void {
  const themeExtend = theme["extend"];
  const extend =
    themeExtend && typeof themeExtend === "object" && !Array.isArray(themeExtend)
      ? (themeExtend as Record<string, unknown>)
      : null;
  const section = (key: string): unknown => extend?.[key] ?? theme[key];

  const colors: Record<string, string> = {};
  flattenLiterals(section("colors"), "", colors);
  const spacing: Record<string, string> = {};
  flattenLiterals(section("spacing"), "", spacing);
  const radii: Record<string, string> = {};
  flattenLiterals(section("borderRadius"), "", radii);
  const fontFamily: Record<string, string> = {};
  flattenLiterals(section("fontFamily"), "", fontFamily);
  const fontSize: Record<string, string> = {};
  flattenLiterals(section("fontSize"), "", fontSize);

  mergeFlat(ctx.tokens.colors, colors);
  mergeFlat(ctx.tokens.spacing, spacing);
  mergeFlat(ctx.tokens.radii, radii);
  mergeFlat(ctx.tokens.fontFamily, fontFamily);
  mergeFlat(ctx.tokens.fontSize, fontSize);

  for (const [key, value] of Object.entries(colors)) {
    const hex = value.trim().toLowerCase();
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(hex)) {
      ctx.tailwind.colorMap[hex] = key;
    }
  }
  for (const [key, value] of Object.entries(spacing)) {
    const px = pxTo(value);
    if (px) ctx.tailwind.spacingMap[px] = key;
  }
  for (const [key, value] of Object.entries(radii)) {
    const px = pxTo(value);
    if (px) ctx.tailwind.radiusMap[px] = key;
  }
  if (Object.keys(colors).length + Object.keys(spacing).length === 0) {
    ctx.unresolved.push({
      file: rel,
      key: "theme",
      reason: "no statically resolvable colors/spacing in theme (or theme.extend)",
    });
  }
}

async function scanTailwind(ctx: Ctx): Promise<void> {
  const candidates = [
    "tailwind.config.ts",
    "tailwind.config.js",
    "tailwind.config.cjs",
    "tailwind.config.mjs",
    join("src", "tailwind.config.ts"),
    join("src", "tailwind.config.js"),
  ];
  for (const candidate of candidates) {
    const file = join(ctx.projectRoot, candidate);
    try {
      await fs.access(file);
    } catch {
      continue;
    }
    const { theme, unresolved } = await parseStaticConfig(file, ctx.projectRoot);
    ctx.unresolved.push(...unresolved);
    absorbTailwindTheme(ctx, theme, relOf(ctx.projectRoot, file));
    pushSource(ctx, { kind: "tailwind", file: relOf(ctx.projectRoot, file), confidence: "high" });
    ctx.sourceFiles.push(file);
    return; // first match wins; the allowlist is ordered by preference
  }
}

/** W3C design tokens ($value leaves), walked anywhere under the root (depth-capped). */
async function scanTokenJson(ctx: Ctx): Promise<void> {
  const found: string[] = [];
  for await (const file of walkFiles(ctx.projectRoot, 0)) {
    const name = file.split(sep).pop() ?? "";
    if (name === "tokens.json" || name.endsWith(".tokens.json")) found.push(file);
    if (found.length >= 20) break;
  }
  for (const file of found.sort()) {
    const rel = relOf(ctx.projectRoot, file);
    const text = await readUnderLimit(file);
    if (text === null) {
      ctx.unresolved.push({ file: rel, key: "(file)", reason: "missing, unreadable, or over the 512 KB limit" });
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      ctx.unresolved.push({ file: rel, key: "(json)", reason: "invalid JSON" });
      continue;
    }
    const flat: Record<string, string> = {};
    flattenW3cTokens(parsed, "", flat);
    const added = assignW3cTokens(ctx.tokens, flat);
    if (added === 0) {
      ctx.unresolved.push({
        file: rel,
        key: "(tokens)",
        reason: "no $value leaves recognized (W3C design tokens format expected)",
      });
      continue;
    }
    pushSource(ctx, { kind: "token-json", file: rel, confidence: "high" });
    ctx.sourceFiles.push(file);
  }
}

/** :root custom properties from CSS under the project (depth-capped). Values are stored verbatim. */
async function scanCssVariables(ctx: Ctx): Promise<void> {
  const cssRoots = ["src", "app", "styles"];
  const cssFiles: string[] = [];
  for (const root of cssRoots) {
    const dir = join(ctx.projectRoot, root);
    try {
      await fs.access(dir);
    } catch {
      continue;
    }
    for await (const file of walkFiles(dir, 1)) {
      if (file.endsWith(".css")) cssFiles.push(file);
      if (cssFiles.length >= 50) break;
    }
    if (cssFiles.length >= 50) break;
  }
  for (const file of cssFiles.sort()) {
    const rel = relOf(ctx.projectRoot, file);
    const text = await readUnderLimit(file);
    if (!text) {
      ctx.unresolved.push({ file: rel, key: "(file)", reason: "missing or over the 512 KB limit" });
      continue;
    }
    let any = false;
    for (const match of text.matchAll(/:root\s*\{([^}]*)\}/gs)) {
      const block = (match[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const decl of block.matchAll(/--([A-Za-z0-9_-]+)\s*:\s*([^;}]+)/g)) {
        const name = decl[1] ?? "";
        const value = (decl[2] ?? "").trim();
        if (!name || !value || value.length > 200) continue;
        let section: keyof DesignProfile["tokens"] | null = null;
        if (/^color|^background|^surface|^accent|^primary/i.test(name)) section = "colors";
        else if (/^spacing|^space|^gap|^pad/i.test(name)) section = "spacing";
        else if (/^radius|^rounded|^corner/i.test(name)) section = "radii";
        else if (/^font-?famil|^typeface/i.test(name)) section = "fontFamily";
        else if (/^font-?size|^text-?size/i.test(name)) section = "fontSize";
        if (!section) continue;
        const key = name.replace(/-/g, "_");
        if (!(key in ctx.tokens[section])) {
          ctx.tokens[section][key] = value;
          any = true;
        }
      }
    }
    if (any) {
      pushSource(ctx, { kind: "css-variables", file: rel, confidence: "medium" });
      ctx.sourceFiles.push(file);
    }
  }
}

async function scanShadcn(ctx: Ctx): Promise<void> {
  const file = join(ctx.projectRoot, "components.json");
  const text = await readUnderLimit(file);
  if (text === null) return; // absence is not an error
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    ctx.unresolved.push({ file: relOf(ctx.projectRoot, file), key: "(json)", reason: "invalid JSON" });
    return;
  }
  if (!parsed || typeof parsed !== "object" || (parsed as Record<string, unknown>)["style"] === undefined) {
    ctx.unresolved.push({
      file: relOf(ctx.projectRoot, file),
      key: "(schema)",
      reason: "no `style` key — not a shadcn components.json",
    });
    return;
  }
  pushSource(ctx, { kind: "shadcn", file: relOf(ctx.projectRoot, file), confidence: "high" });
  ctx.sourceFiles.push(file);
}

async function scanStorybook(ctx: Ctx): Promise<void> {
  for (const name of ["main.ts", "main.js", "main.cjs", "main.mjs"]) {
    const file = join(ctx.projectRoot, ".storybook", name);
    try {
      await fs.access(file);
    } catch {
      continue;
    }
    pushSource(ctx, { kind: "storybook", file: relOf(ctx.projectRoot, file), confidence: "low" });
    ctx.sourceFiles.push(file);
    return;
  }
}

async function scanPackageDeps(ctx: Ctx): Promise<void> {
  const file = join(ctx.projectRoot, "package.json");
  const text = await readUnderLimit(file);
  if (text === null) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return;
  }
  const deps = {
    ...((parsed as Record<string, unknown>)["dependencies"] as Record<string, unknown> | undefined),
    ...((parsed as Record<string, unknown>)["devDependencies"] as Record<string, unknown> | undefined),
  };
  if (!deps) return;
  const names = Object.keys(deps);
  const matchesUi = names.some(
    (n) =>
      n === "tailwindcss" ||
      n === "class-variance-authority" ||
      n.startsWith("@radix-ui/") ||
      n === "shadcn-ui" ||
      n === "radix-ui",
  );
  if (matchesUi) {
    pushSource(ctx, { kind: "components", file: "package.json", confidence: "medium" });
    ctx.sourceFiles.push(file);
  }
}

export interface ScanOptions {
  /** Write .intent/design-profile.json and return the path. */
  writeTo?: string;
}

export async function scanProject(projectRoot: string, options: ScanOptions = {}): Promise<ScanResult> {
  const root = resolve(projectRoot);
  const ctx: Ctx = {
    projectRoot: root,
    sources: [],
    unresolved: [],
    tokens: { colors: {}, spacing: {}, radii: {}, fontFamily: {}, fontSize: {} },
    tailwind: { colorMap: {}, spacingMap: {}, radiusMap: {} },
    sourceFiles: [],
  };

  await scanTailwind(ctx);
  await scanShadcn(ctx);
  await scanStorybook(ctx);
  await scanPackageDeps(ctx);
  await scanTokenJson(ctx);
  await scanCssVariables(ctx);

  // Sort everything: sources by file, tokens by key.
  for (const section of Object.values(ctx.tokens)) {
    const sorted = Object.fromEntries(Object.entries(section).sort(([a], [b]) => a.localeCompare(b)));
    for (const key of Object.keys(section)) delete section[key];
    Object.assign(section, sorted);
  }
  for (const section of Object.values(ctx.tailwind)) {
    const sorted = Object.fromEntries(Object.entries(section).sort(([a], [b]) => a.localeCompare(b)));
    for (const key of Object.keys(section)) delete section[key];
    Object.assign(section, sorted);
  }
  ctx.sources.sort((a, b) => a.file.localeCompare(b.file));
  ctx.unresolved.sort((a, b) => a.file.localeCompare(b.file) || a.key.localeCompare(b.key));

  const generatedAt = await newestMtime(ctx.sourceFiles);

  const hasTailwindMaps =
    Object.keys(ctx.tailwind.colorMap).length +
      Object.keys(ctx.tailwind.spacingMap).length +
      Object.keys(ctx.tailwind.radiusMap).length >
    0;

  const profile: DesignProfile = {
    schemaVersion: 1,
    generatedAt,
    sources: ctx.sources,
    tokens: ctx.tokens,
    ...(hasTailwindMaps ? { tailwind: ctx.tailwind } : {}),
    components: [],
    unresolved: ctx.unresolved,
  };

  const validated = DesignProfileSchema.parse(profile);

  let writtenTo: string | null = null;
  if (options.writeTo) {
    const intentDir = resolve(root, ".intent");
    await fs.mkdir(intentDir, { recursive: true });
    const target = join(intentDir, "design-profile.json");
    await writeAtomic(target, JSON.stringify(validated, null, 2));
    writtenTo = target;
  }

  return { profile: validated, writtenTo };
}
