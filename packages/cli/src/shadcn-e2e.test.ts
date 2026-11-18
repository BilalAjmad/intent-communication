import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve, join } from "node:path";
import { scanProject } from "./scan";
import { exportToReact } from "@intent/engine";
import type { Scene } from "@intent/schema";

let testDir: string;

async function write(rel: string, content: string): Promise<void> {
  const target = join(testDir, rel);
  await fs.mkdir(resolve(target, ".."), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

beforeEach(async () => {
  testDir = resolve(os.tmpdir(), `.test-shadcn-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
});

const SCREEN = "s_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const BUTTON = "o_01ARZ3NDEKTSV4RRFFQ69G5FAV";
const INPUT = "o_02ARZ3NDEKTSV4RRFFQ69G5FAV";

function scene(): Scene {
  return {
    version: 1, revision: 1, createdAt: "2026-11-13T00:00:00.000Z", updatedAt: "2026-11-13T00:00:00.000Z",
    screens: {
      [SCREEN]: { id: SCREEN, type: "screen" as const, parentId: null, children: [BUTTON, INPUT], props: { title: "Home", width: 390, height: 844 }, style: {}, meta: {} },
    },
    objects: {
      [SCREEN]: { id: SCREEN, type: "screen" as const, parentId: null, children: [BUTTON, INPUT], props: { title: "Home", width: 390, height: 844 }, style: {}, meta: {} },
      [BUTTON]: { id: BUTTON, type: "button" as const, parentId: SCREEN, children: [], props: { label: "Ship it", variant: "primary", disabled: true }, style: { backgroundColor: "#2563eb" }, meta: {} },
      [INPUT]: { id: INPUT, type: "input" as const, parentId: SCREEN, children: [], props: { placeholder: "Email", required: true }, style: {}, meta: {} },
    },
    screenOrder: [SCREEN],
    metadata: { name: "Home", tags: [] },
  } as Scene;
}

describe("trd 13.7 shadcn component mapping end-to-end", () => {
  it("scanner detects ui components and the exporter imports them", async () => {
    await write("components.json", JSON.stringify({ style: "new-york", aliases: { ui: "@/components/ui" } }));
    await write("src/components/ui/button.tsx", "export function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {\n  return <button className={className} {...props} />;\n}\n");
    await write("src/components/ui/input.tsx", "export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {\n  return <input className={className} {...props} />;\n}\n");

    const { profile } = await scanProject(testDir);
    expect(profile.components).toHaveLength(2);
    expect(profile.components.map((c) => c.role).sort()).toEqual(["button", "input"]);
    expect(profile.components.find((c) => c.role === "button")?.importPath).toBe("@/components/ui/button");

    const files = exportToReact(scene(), { designProfile: profile });
    const home = files["intent-export/screens/Home.tsx"] as string;
    expect(home).toContain('import { Button } from "@/components/ui/button";');
    expect(home).toContain('import { Input } from "@/components/ui/input";');
    expect(home).toContain('<Button type={"button"} variant={"primary"} disabled>{"Ship it"}</Button>');
    expect(home).toContain('aria-label={"Email"}');
    expect(home).toContain("required");
    expect(home).not.toContain('className="intent-button intent-button');
  });

  it("without a profile, output falls back to CSS-var inline styles", async () => {
    const files = exportToReact(scene());
    const home = files["intent-export/screens/Home.tsx"] as string;
    expect(home).toContain('className={"intent-button intent-button-primary"}');
    expect(home).not.toContain('import { Button }');
  });
});
