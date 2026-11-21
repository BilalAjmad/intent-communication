import { promises as fs } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { writeAtomic } from "@intent/core";
import { SETUP_MARKERS } from "./targets.js";
import type { AgentAdapter, Scope, SetupEnv, SetupResult, SetupTarget, SetupStatus } from "./types.js";

export interface ApplySetupOptions {
  env: SetupEnv;
  scope: Scope;
  adapters: AgentAdapter[];
  selected: string[];
  dryRun: boolean;
  uninstall: boolean;
  /** Install even when an agent was not detected (--all). */
  all?: boolean;
}

async function assertSafe(file: string, env: SetupEnv): Promise<string> {
  const abs = resolve(file);
  const roots = [resolve(env.home), resolve(env.projectRoot)];
  if (!roots.some((root) => abs === root || abs.startsWith(root + sep))) {
    throw new Error(`Refusing to write outside home/project: ${abs}`);
  }
  const st = await fs.lstat(abs).catch(() => null);
  if (st?.isSymbolicLink()) throw new Error(`Refusing to edit a symlink: ${abs}`);
  return abs;
}

async function backup(abs: string, dryRun: boolean): Promise<void> {
  if (dryRun) return;
  const st = await fs.lstat(abs).catch(() => null);
  if (!st) return;
  await fs.mkdir(dirname(abs), { recursive: true });
  await fs.copyFile(abs, `${abs}.intent-backup-${Date.now()}`);
}

async function readText(abs: string): Promise<string | null> {
  try {
    return await fs.readFile(abs, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function mergeJson(target: SetupTarget, env: SetupEnv, opts: ApplySetupOptions): Promise<boolean> {
  const abs = await assertSafe(target.path, env);
  const raw = await readText(abs);
  let parsed: Record<string, unknown> = {};
  if (raw !== null) {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error(`${abs}: not valid JSON — refusing to overwrite; fix it manually.`);
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`${abs}: expected a JSON object — refusing to overwrite.`);
    }
    parsed = value as Record<string, unknown>;
  }
  const key = target.jsonKey ?? "mcpServers";
  if (parsed[key] !== undefined && (typeof parsed[key] !== "object" || parsed[key] === null || Array.isArray(parsed[key]))) {
    throw new Error(`${abs}: "${key}" must be a JSON object — refusing to overwrite.`);
  }
  const servers = { ...((parsed[key] ?? {}) as Record<string, unknown>) };
  if (opts.uninstall) {
    if (!("intent" in servers)) return false;
    delete servers["intent"];
  } else {
    if (JSON.stringify(servers["intent"] ?? null) === JSON.stringify(target.entry)) return false;
    servers["intent"] = target.entry;
  }
  const next = { ...parsed, [key]: servers };
  const changed = JSON.stringify(next) !== JSON.stringify(parsed);
  if (!changed) return false;
  await backup(abs, opts.dryRun);
  if (!opts.dryRun) {
    await fs.mkdir(dirname(abs), { recursive: true });
    await writeAtomic(abs, JSON.stringify(next, null, 2) + "\n");
  }
  return true;
}

function stripBlocks(raw: string, start: string, end: string): string {
  let out = raw;
  let guard = 0;
  while (guard++ < 50) {
    const s = out.indexOf(start);
    const e = out.indexOf(end, s + start.length);
    if (s === -1 || e === -1 || e <= s) break;
    out = out.slice(0, s) + out.slice(e + end.length);
  }
  return out;
}

async function mergeText(target: SetupTarget, env: SetupEnv, opts: ApplySetupOptions): Promise<boolean> {
  const abs = await assertSafe(target.path, env);
  const raw = await readText(abs);
  const body = target.content ?? "";
  const needsWrite = opts.uninstall ? raw !== null && raw.includes(SETUP_MARKERS.START) : raw !== body;
  if (!needsWrite) return false;
  let next: string;
  if (opts.uninstall) {
    next = stripBlocks(raw ?? "", SETUP_MARKERS.START, SETUP_MARKERS.END).trimEnd() + "\n";
    if (next.trim().length === 0) {
      if (!opts.dryRun) await fs.rm(abs, { force: true });
      return true;
    }
  } else if (raw === null) {
    next = body;
  } else {
    const without = stripBlocks(raw, SETUP_MARKERS.START, SETUP_MARKERS.END);
    next = (without.trimEnd() + "\n" + body).trimStart();
  }
  await backup(abs, opts.dryRun);
  if (!opts.dryRun) {
    await fs.mkdir(dirname(abs), { recursive: true });
    await writeAtomic(abs, next);
  }
  return true;
}

async function applyCommand(target: SetupTarget, env: SetupEnv, opts: ApplySetupOptions): Promise<boolean> {
  const abs = await assertSafe(target.path, env);
  const raw = await readText(abs);
  const body = target.content ?? "";
  if (opts.uninstall) {
    if (raw === null) return false;
    if (raw.trim() === body.trim()) {
      if (!opts.dryRun) await fs.rm(abs, { force: true });
      return true;
    }
    if (!raw.includes("<!-- intent:command:start -->")) return false;
    const next = stripBlocks(raw, "<!-- intent:command:start -->", "<!-- intent:command:end -->").trimEnd() + "\n";
    await backup(abs, opts.dryRun);
    if (!opts.dryRun) await writeAtomic(abs, next);
    return true;
  }
  if (raw === body) return false;
  if (raw !== null && !raw.includes("<!-- intent:command:start -->")) {
    // Never overwrite a user-authored command file with the same name.
    return false;
  }
  await backup(abs, opts.dryRun);
  if (!opts.dryRun) {
    await fs.mkdir(dirname(abs), { recursive: true });
    await writeAtomic(abs, body);
  }
  return true;
}

async function applyTarget(target: SetupTarget, env: SetupEnv, opts: ApplySetupOptions): Promise<boolean> {
  if (target.kind === "mcp") return mergeJson(target, env, opts);
  if (target.kind === "command") return applyCommand(target, env, opts);
  return mergeText(target, env, opts);
}

/** Apply the selected adapters. Dry-run computes the same plan but writes nothing. */
export async function applySetup(opts: ApplySetupOptions): Promise<SetupResult[]> {
  const results: SetupResult[] = [];
  for (const adapter of opts.adapters) {
    if (!opts.selected.includes(adapter.id)) continue;
    const detected = await adapter.detect(opts.env, opts.scope);
    if (!detected && opts.all !== true) {
      results.push({ agent: adapter.id, status: "skipped", paths: [], note: "not detected" });
      continue;
    }
    const targets = adapter.targets(opts.env, opts.scope);
    if (targets.length === 0) {
      results.push({ agent: adapter.id, status: "manual", paths: [], note: adapter.note ?? "manual configuration required" });
      continue;
    }
    try {
      let changed = false;
      const paths: string[] = [];
      for (const target of targets) {
        if (await applyTarget(target, opts.env, opts)) changed = true;
        paths.push(target.path);
      }
      results.push({
        agent: adapter.id,
        status: adapter.manualOnly ? "manual" : changed ? "configured" : "unchanged",
        paths,
        ...(adapter.manualOnly
          ? { note: adapter.note ?? "MCP config needs the manual snippet" }
          : detected ? {} : { note: "configured with --all (not detected)" }),
      });
    } catch (err) {
      results.push({
        agent: adapter.id,
        status: "error",
        paths: [],
        note: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

/** Detection status without writing (used by the interactive checklist). */
export async function detectAdapters(
  adapters: AgentAdapter[],
  env: SetupEnv,
  scope: Scope,
): Promise<{ agent: string; name: string; detected: boolean }[]> {
  const out: { agent: string; name: string; detected: boolean }[] = [];
  for (const adapter of adapters) out.push({ agent: adapter.id, name: adapter.name, detected: await adapter.detect(env, scope) });
  return out;
}

/** Status label for the final report table. */
export function statusLabel(status: SetupStatus): string {
  return {
    configured: "configured",
    unchanged: "already configured",
    manual: "manual snippet",
    skipped: "skipped (not detected)",
    error: "ERROR",
  }[status];
}
