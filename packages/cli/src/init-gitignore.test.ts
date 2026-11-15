import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { initCommand } from "./index";

// `intent init` writes .intent/.gitignore per trd 14.3:
//   ignores   patches/ annotations/ interview/ runtime.json state.json tmp/ logs/ metrics.json
//   keeps     scene.json locks.json versions/ config.json profile.json design-profile.json
// Content is asserted directly, and git itself is asked (git check-ignore) when available.

const REQUIRED_IGNORES = [
  "patches/",
  "annotations/",
  "interview/",
  "runtime.json",
  "state.json",
  "tmp/",
  "logs/",
  "metrics.json",
];

// Files that must NOT be ignored (explicit patterns must be absent; comment mentions are fine)
const FORBIDDEN_IGNORES = [
  "scene.json",
  "locks.json",
  "versions/",
  "config.json",
  "profile.json",
  "design-profile.json",
];

let dir: string;

beforeEach(async () => {
  dir = resolve(tmpdir(), `intent gitignore ${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(dir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
});

const gitignorePath = () => resolve(dir, ".intent", ".gitignore");

describe("intent init — .intent/.gitignore (trd 14.3)", () => {
  it("creates .intent/.gitignore with exactly the trd 14.3 ignore patterns and keeps the rest", async () => {
    await initCommand(dir);
    const content = await fs.readFile(gitignorePath(), "utf-8");
    const lines = content.split(/\r?\n/).map((l) => l.trim());
    for (const required of REQUIRED_IGNORES) {
      expect(lines).toContain(required);
    }
    // No rule (non-comment, non-empty) may ignore the kept files
    const rules = lines.filter((l) => l && !l.startsWith("#"));
    for (const kept of FORBIDDEN_IGNORES) {
      expect(rules, `rule found ignoring ${kept}`).not.toContain(kept);
      expect(rules.some((r) => r === kept || r.startsWith(kept))).toBe(false);
    }
  });

  it("the default scene file (scenes/default.json) matches no ignore rule", async () => {
    await initCommand(dir);
    const content = await fs.readFile(gitignorePath(), "utf-8");
    expect(content).not.toMatch(/^scenes?\//m);
    expect(content).not.toContain("*.json");
  });

  it("--dry-run does not create .gitignore", async () => {
    await initCommand(dir, { dryRun: true });
    await expect(fs.stat(gitignorePath())).rejects.toThrow();
  });

  const gitOk = (() => {
    try {
      execFileSync("git", ["--version"], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  })();

  it.runIf(gitOk)("git check-ignore: working state ignored, scene/locks/versions/config kept", async () => {
    await initCommand(dir);
    execFileSync("git", ["init"], { cwd: dir, stdio: "pipe" });
    const check = (p: string) => {
      try {
        execFileSync("git", ["check-ignore", "-q", p], { cwd: dir, stdio: "pipe" });
        return true;
      } catch {
        return false;
      }
    };
    expect(check(".intent/interview/state.json")).toBe(true); // interview/ + state.json
    expect(check(".intent/runtime.json")).toBe(true);
    expect(check(".intent/metrics.json")).toBe(true);
    expect(check(".intent/patches/x.json")).toBe(true);
    expect(check(".intent/scenes/default.json")).toBe(false);
    expect(check(".intent/locks/s_x.locks.json")).toBe(false);
    expect(check(".intent/versions/v-1.json")).toBe(false);
    expect(check(".intent/config.json")).toBe(false);
    expect(check(".intent/profile.json")).toBe(false);
    expect(check(".intent/design-profile.json")).toBe(false);
  });
});
