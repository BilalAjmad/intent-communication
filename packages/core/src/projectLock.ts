import { LockPort } from "./ports.js";
import { IntentError, ErrorCodes } from "./error.js";

/**
 * Cross-process critical section keyed by a synthetic scene id (the trd 9.2
 * scene-lock mechanics: ownerToken-verified pid lock with stale reclaim).
 * Used to serialize the read-modify-write of `.intent/interview/state.json`
 * and `.intent/feedback/<scene>.json`, which both the MCP child process and
 * the Studio server process write. Without this, last-writer-wins loses
 * answers and feedback transitions between the two processes.
 *
 * The lock lives at `.intent/tmp/<name>.lock`; `name` is reused as a sceneId,
 * so it must pass assertSafeId (letters, digits, underscore, hyphen).
 *
 * Acquire is retried briefly: on macOS the lock file's removal can lag behind
 * release by a few ms under fast sequential requests, so a single failed
 * acquire is not a hard failure. Retries are bounded (5 x 10 ms) to avoid
 * hiding genuine contention.
 */
export async function withProjectLock<T>(
  lockPort: LockPort,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  let acquired = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    acquired = await lockPort.acquireSceneLock(name);
    if (acquired) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  if (!acquired) {
    throw new IntentError(ErrorCodes.E_LOCKED, `Project lock "${name}" is busy; retry shortly`);
  }
  try {
    return await fn();
  } finally {
    await lockPort.releaseSceneLock(name);
  }
}
