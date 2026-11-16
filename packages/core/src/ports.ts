// Port interfaces + re-exports. Implementations moved to dedicated modules;
// behavior unchanged (every import of ./ports.js keeps working).
export type { StoragePort, LockPort, CryptoPort } from "./port-types.js";
export { createStoragePort } from "./storage-port.js";
export { createLockPort } from "./lock-port.js";
export { createCryptoPort } from "./crypto.js";
