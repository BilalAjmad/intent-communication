import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve, join } from "node:path";
import { scanProject } from "./scan";

let testDir: string;

async function write(rel: string, content: string): Promise<void> {
  const target = join(testDir, rel);
  await fs.mkdir(resolve(target, ".."), { recursive: true });
  await fs.writeFile(target, content, "utf-8");
}

beforeEach(async () => {
  testDir = resolve(os.tmpdir(), `.test-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

const TAILWIND_CONFIG = `
const brandColor = "#bada55";
export default {
  theme: {
    extend: {
      colors: {
        primary: "#2563eb",
        brand: brandColor,
        computed: () => "#ffffff",
      },
      spacing: { md: "16px", lg: "24px" },
      borderRadius: { md: "8px" },
      fontSize: { sm: "14px" },
    },
  },
};
`;

const W3C_TOKENS = JSON.stringify({
  color: {
    surface: { $value: "#f8f9fa" },
    text: { primary: { $value: "#212529" } },
  },
  spacing: { md: { $value: "16px" }, xl: { $value: "32px" } },
});

const CSS_ROOT = `
:root {
  --color-surface: #ffffff;
  --spacing-lg: 24px;
  --radius-md: 6px;
  color-scheme: light dark;
}
.other { color: red; }
`;

describe("Scanner (trd 16)", () => {
  it("extracts literal tailwind theme tokens and static aliases, skips calls", async () => {
    await write("tailwind.config.ts", TAILWIND_CONFIG);
    const { profile } = await scanProject(testDir);
    expect(profile.tokens.colors).toMatchObject({ primary: "#2563eb", brand: "#bada55" });
    expect(profile.tokens.spacing).toMatchObject({ md: "16px", lg: "24px" });
    expect(profile.tailwind?.colorMap?.["#2563eb"]).toBe("primary");
    expect(profile.unresolved.some((u) => u.key.includes("computed"))).toBe(true);
  });

  it("resolves shorthand properties ({ brand }) through aliases", async () => {
    await write("tailwind.config.ts", "const brand = '#bada55';\nexport default { theme: { extend: { colors: { brand, primary: '#2563eb' } } } };");
    const { profile } = await scanProject(testDir);
    expect(profile.tokens.colors).toMatchObject({ brand: "#bada55", primary: "#2563eb" });
    expect(profile.unresolved).toEqual([]);
  });

  it("reads W3C token json files and routes them to sections", async () => {
    await write("tokens/tokens.json", W3C_TOKENS);
    const { profile } = await scanProject(testDir);
    expect(profile.tokens.colors).toMatchObject({ "color.surface": "#f8f9fa", "color.text.primary": "#212529" });
    expect(profile.tokens.spacing).toMatchObject({ "spacing.md": "16px", "spacing.xl": "32px" });
    expect(profile.sources.map((s) => s.kind)).toContain("token-json");
  });

  it("reads :root custom properties from CSS under src/", async () => {
    await write("src/app.css", CSS_ROOT);
    const { profile } = await scanProject(testDir);
    expect(profile.tokens.colors).toMatchObject({ color_surface: "#ffffff" });
    expect(profile.tokens.spacing).toMatchObject({ spacing_lg: "24px" });
    expect(profile.tokens.radii).toMatchObject({ radius_md: "6px" });
    expect(profile.sources.map((s) => s.kind)).toContain("css-variables");
  });

  it("ignores node_modules entirely", async () => {
    await write("node_modules/pkg/tokens.json", JSON.stringify({ color: { evil: { $value: "#000000" } } }));
    const { profile } = await scanProject(testDir);
    expect(profile.tokens.colors).toEqual({});
    expect(JSON.stringify(profile.sources)).not.toContain("node_modules");
  });

  it("flags invalid W3C json as unresolved without crashing", async () => {
    await write("tokens/tokens.json", "not json {{{");
    const { profile } = await scanProject(testDir);
    expect(profile.unresolved.some((u) => u.key === "(json)")).toBe(true);
  });

  it("reports shadcn components.json as a high-confidence source", async () => {
    await write("components.json", JSON.stringify({ style: "new-york", aliases: { utils: "@/lib/utils" } }));
    const { profile } = await scanProject(testDir);
    expect(profile.sources).toContainEqual({ kind: "shadcn", file: "components.json", confidence: "high" });
  });

  it("detects .storybook/main as a low-confidence source without parsing it", async () => {
    await write(".storybook/main.ts", "export default { framework: () => { throw new Error('never executes') } }");
    const { profile } = await scanProject(testDir);
    expect(profile.sources).toContainEqual({ kind: "storybook", file: ".storybook/main.ts", confidence: "low" });
  });

  it("detects tailwind/radix UI deps from package.json as a medium-confidence components source", async () => {
    await write("package.json", JSON.stringify({ dependencies: { tailwindcss: "^4.0.0" } }));
    const { profile } = await scanProject(testDir);
    expect(profile.sources).toContainEqual({ kind: "components", file: "package.json", confidence: "medium" });
  });

  it("writes .intent/design-profile.json and is deterministic aside from generatedAt", async () => {
    await write("tailwind.config.ts", TAILWIND_CONFIG);
    await write("tokens/tokens.json", W3C_TOKENS);
    const first = await scanProject(testDir, { writeTo: testDir });
    expect(first.writtenTo).toBe(resolve(testDir, ".intent", "design-profile.json"));
    const raw = await fs.readFile(first.writtenTo as string, "utf-8");
    const written = JSON.parse(raw) as { schemaVersion: number };
    expect(written.schemaVersion).toBe(1);
    const second = await scanProject(testDir);
    const strip = (p: typeof first.profile) => ({ ...p, generatedAt: null });
    expect(strip(second.profile)).toEqual(strip(first.profile));
  });

  it("produces an honest empty profile on an empty project (no sources, no fabricated tokens)", async () => {
    const { profile } = await scanProject(testDir);
    expect(profile.sources).toEqual([]);
    expect(profile.tokens).toEqual({ colors: {}, spacing: {}, radii: {}, fontFamily: {}, fontSize: {} });
    expect(profile.unresolved).toEqual([]);
  });
});
