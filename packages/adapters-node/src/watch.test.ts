import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import { resolve, join } from "node:path";
import { createFileWatcher, type FileWatcher } from "./watch";

let dir: string;
let watcher: FileWatcher | null = null;

beforeEach(async () => {
  dir = resolve(os.tmpdir(), `.test-watch-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(dir, { recursive: true });
});

afterEach(async () => {
  if (watcher) watcher.close();
  watcher = null;
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
});

async function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("Timed out waiting for condition");
}

describe("createFileWatcher (trd 9.4)", () => {
  it("emits a change for a file written under the watched directory", async () => {
    const events: string[] = [];
    watcher = createFileWatcher(dir, (rel) => events.push(rel), { debounceMs: 50 });
    await fs.writeFile(join(dir, "probe.json"), "{}", "utf-8");
    await waitFor(() => events.length > 0);
    expect(events.some((e) => e.endsWith("probe.json"))).toBe(true);
  });

  it("ignores paths under tmp/ and logs/", async () => {
    const events: string[] = [];
    watcher = createFileWatcher(dir, (rel) => events.push(rel), { debounceMs: 50 });
    await fs.mkdir(join(dir, "tmp"), { recursive: true });
    await fs.mkdir(join(dir, "logs"), { recursive: true });
    await fs.writeFile(join(dir, "tmp", "a.json"), "{}", "utf-8");
    await fs.writeFile(join(dir, "logs", "b.json"), "{}", "utf-8");
    await new Promise((r) => setTimeout(r, 300));
    expect(events).toEqual([]);
  });

  it("ignores writeAtomic temp files (*.tmp-*)", async () => {
    const events: string[] = [];
    watcher = createFileWatcher(dir, (rel) => events.push(rel), { debounceMs: 50 });
    await fs.writeFile(join(dir, "scene.json.tmp-12345-abcde"), "{}", "utf-8");
    await new Promise((r) => setTimeout(r, 300));
    expect(events).toEqual([]);
  });

  it("coalesces rapid writes to the same path into one event", async () => {
    const events: string[] = [];
    watcher = createFileWatcher(dir, (rel) => events.push(rel), { debounceMs: 100 });
    await fs.writeFile(join(dir, "burst.json"), "one", "utf-8");
    await fs.writeFile(join(dir, "burst.json"), "two", "utf-8");
    await fs.writeFile(join(dir, "burst.json"), "three", "utf-8");
    await waitFor(() => events.length > 0);
    await new Promise((r) => setTimeout(r, 200));
    expect(events.filter((e) => e.endsWith("burst.json"))).toHaveLength(1);
  });

  it("falls back to polling (and stays functional) when fs.watch is unavailable", async () => {
    const missing = join(dir, "does-not-exist");
    const events: string[] = [];
    let fallbackCalled = false;
    watcher = createFileWatcher(missing, (rel) => events.push(rel), {
      debounceMs: 50,
      pollIntervalMs: 60,
      onFallback: () => {
        fallbackCalled = true;
      },
    });
    expect(fallbackCalled).toBe(true);
    expect(watcher.mode).toBe("poll");
    await fs.mkdir(missing, { recursive: true });
    await fs.writeFile(join(missing, "later.json"), "{}", "utf-8");
    await waitFor(() => events.some((e) => e.endsWith("later.json")), 5000);
  });
});
