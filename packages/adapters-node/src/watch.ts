import { promises as fsp, watch as fsWatch } from "node:fs";
import { resolve, sep } from "node:path";

/**
 * trd 9.4 — file watcher for `.intent/`.
 *
 * Primary: `fs.watch(dir, { recursive: true })` — supported on Windows, macOS,
 * and Linux ≥ 20 (Node ≥ 20); no external dependency. Events are coalesced
 * with a 50 ms trailing debounce per path (atomic write = tmp file + rename,
 * which would otherwise double-fire).
 *
 * Polling fallback: if the watcher fails to start or errors at runtime, this
 * module polls `mtime` + `size` of every file under the directory every
 * 1 000 ms and reports the diff. The poller also retries the fs watcher every
 * ~5 s (handles ".intent does not exist yet at startup") and upgrades in
 * place when the watcher becomes available.
 *
 * AQ1 resolution: built-in `fs.watch` + polling fallback, not a new dependency.
 * Paths are containment-checked; tmp/logs/node_modules/.git and writeAtomic
 * temp files are ignored.
 */

export interface FileWatcher {
  /** "watch" = fs.watch recursive; "poll" = mtime/size polling fallback. */
  readonly mode: "watch" | "poll";
  close(): void;
}

export interface FileWatcherOptions {
  /** Trailing debounce per path in ms. Default 50 (trd 9.4). */
  debounceMs?: number;
  /** Polling interval in ms. Default 1000 (trd 9.4). */
  pollIntervalMs?: number;
  /** Cap on files snapshotted by the poller. Default 1000. */
  maxFiles?: number;
  /** Called exactly once when the poller takes over (trd 9.4: show a notice). */
  onFallback?: () => void;
}

const IGNORED = [
  /(^|[\\/])(tmp|logs|node_modules|\.git)([\\/]|$)/,
  // Current writeAtomic naming: <13-digit ms>-<base36>.tmp (same dir as target).
  /(^|[\\/])[0-9]{13}-[a-z0-9]+\.tmp$/,
  // Legacy writeAtomic naming: <name>.tmp-<suffix> (older builds; may exist on disk).
  /\.tmp-[A-Za-z0-9_-]+$/,
  /~$/,
];

function normalizeRel(dir: string, candidate: string): string | null {
  const abs = resolve(dir, candidate);
  if (abs !== dir && !abs.startsWith(dir + sep)) return null;
  const rel = abs.slice(dir.length).replace(/^[\\/]+/, "").split(sep).join("/");
  if (!rel) return null;
  if (IGNORED.some((re) => re.test("/" + rel))) return null;
  return rel;
}

export function createFileWatcher(
  dir: string,
  onPath: (relativePath: string) => void,
  options: FileWatcherOptions = {},
): FileWatcher {
  const debounceMs = options.debounceMs ?? 50;
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const maxFiles = options.maxFiles ?? 1000;

  dir = resolve(dir);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const emit = (rel: string) => {
    const existing = timers.get(rel);
    if (existing) clearTimeout(existing);
    timers.set(rel, setTimeout(() => {
      timers.delete(rel);
      onPath(rel);
    }, debounceMs));
  };

  let watcher: ReturnType<typeof fsWatch> | null = null;
  let poller: ReturnType<typeof setInterval> | null = null;
  let pollCount = 0;
  let closed = false;
  let fellBack = false;
  let mode: "watch" | "poll" = "watch";

  const stopPoller = () => {
    if (poller) clearInterval(poller);
    poller = null;
  };
  const stopWatcher = () => {
    if (watcher) {
      try { watcher.close(); } catch { /* already closed */ }
      watcher = null;
    }
  };

  const snapshot = new Map<string, string>();
  const walk = async (): Promise<Map<string, string>> => {
    const out = new Map<string, string>();
    const visit = async (current: string, depth: number): Promise<void> => {
      if (depth > 6 || out.size >= maxFiles) return;
      let entries: import("node:fs").Dirent[];
      try {
        entries = await fsp.readdir(current, { withFileTypes: true });
      } catch {
        return; // dir may not exist yet — the poller retries
      }
      for (const entry of entries) {
        if (out.size >= maxFiles) return;
        const full = resolve(current, entry.name);
        const rel = normalizeRel(dir, full);
        if (!rel) continue;
        if (entry.isDirectory()) {
          await visit(full, depth + 1);
          continue;
        }
        try {
          const stat = await fsp.stat(full);
          out.set(rel, `${stat.mtimeMs}:${stat.size}`);
        } catch {
          // transient read failure — skip; next poll compares again
        }
      }
    };
    await visit(dir, 0);
    return out;
  };

  const pollOnce = async (): Promise<void> => {
    if (!snapshotSeeded) return; // baseline not ready yet — never diff against an empty snapshot
    const current = await walk();
    for (const [rel, stamp] of current) {
      if (snapshot.get(rel) !== stamp) emit(rel);
    }
    for (const rel of snapshot.keys()) {
      if (!current.has(rel)) emit(rel);
    }
    snapshot.clear();
    for (const [rel, stamp] of current) snapshot.set(rel, stamp);
  };

  let snapshotSeeded = false;
  const startPoller = () => {
    if (poller || closed) return;
    mode = "poll";
    if (!fellBack && options.onFallback) {
      fellBack = true;
      try { options.onFallback(); } catch { /* notice must never break the watcher */ }
    }
    // Seed the baseline BEFORE any diff runs — a file present at seed time is
    // baseline (not a change); files appearing after seeding diff normally.
    if (!snapshotSeeded) {
      void walk()
        .then((initial) => {
          snapshot.clear();
          for (const [rel, stamp] of initial) snapshot.set(rel, stamp);
          snapshotSeeded = true;
        })
        .catch(() => {
          snapshotSeeded = true; // a broken tree still marks seed done; diffs will surface errors honestly
        });
    }
    pollCount = 0;
    poller = setInterval(() => {
      pollCount += 1;
      void pollOnce();
      // Retry the fs watcher every ~5 polls (handles ".intent did not exist at start").
      if (pollCount % 5 === 0 && !closed) tryStartWatcher();
    }, pollIntervalMs);
  };

  const tryStartWatcher = (): boolean => {
    try {
      const handle = fsWatch(dir, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        const rel = normalizeRel(dir, filename);
        if (rel) emit(rel);
      });
      handle.on("error", () => {
        stopWatcher();
        startPoller();
      });
      watcher = handle;
      mode = "watch";
      stopPoller();
      return true;
    } catch {
      return false;
    }
  };

  const started = tryStartWatcher();
  if (!started) {
    startPoller();
  }

  return {
    get mode() {
      return mode;
    },
    close() {
      closed = true;
      stopPoller();
      stopWatcher();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
}
