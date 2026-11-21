import { resolve } from "node:path";
import {
  StoragePort,
  LockPort,
  CryptoPort,
  IntentError,
  ErrorCodes,
  isIntentError,
  createStoragePort,
  createLockPort,
} from "@intent/core";

/**
 * File-backed storage port for the local Studio/CLI surfaces (trd 9.1).
 * Single implementation lives in @intent/core (hardened: byte-capped reads,
 * schema-validated locks, ancestor-aware path checks, atomic PNG writes) —
 * this re-export preserves the adapters-node API surface.
 */
export const createFileStoragePort: (projectRoot: string) => StoragePort = createStoragePort;

/** File-backed lock port: object locks in `.intent/locks/`, scene lock in `.intent/tmp/`. */
export function createFileLockPort(projectRoot: string): LockPort {
  const intentDir = resolve(projectRoot, ".intent");
  return createLockPort(createFileStoragePort(projectRoot), resolve(intentDir, "tmp"));
}

export { IntentError, ErrorCodes, isIntentError, createLockPort };
export { createFileWatcher } from "./watch.js";
export type { FileWatcher, FileWatcherOptions } from "./watch.js";
export { createNodeCryptoPort } from "./crypto-port.js";
export type { StoragePort, LockPort, CryptoPort };
export { findFirstRenderBaseline } from "./versions-baseline.js";
export type { FirstRenderBaseline } from "./versions-baseline.js";
