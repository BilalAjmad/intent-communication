import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * In-memory session table for the local Studio server (trd 11.2).
 * Opaque 32-byte session ids; expired entries are evicted lazily on creation;
 * the table is hard-capped so a leaked token cannot grow it without bound.
 */
export class SessionStore {
  private readonly sessions = new Map<string, number>();

  constructor(private readonly maxAgeSeconds: number) {}

  /** Mint a new opaque session id, sweeping expired entries first. */
  create(): string {
    const now = Date.now();
    this.sweep(now);
    if (this.sessions.size >= 1024) {
      const oldest = this.sessions.keys().next();
      if (!oldest.done) this.sessions.delete(oldest.value);
    }
    const id = randomBytes(32).toString("hex");
    this.sessions.set(id, now);
    return id;
  }

  /** Constant-time validity check; expired sessions are evicted here too. */
  isValid(id: string | null): boolean {
    if (!id) return false;
    const now = Date.now();
    for (const [live, createdAt] of this.sessions) {
      if (live.length !== id.length) continue;
      const a = Buffer.from(id, "utf-8");
      const b = Buffer.from(live, "utf-8");
      if (timingSafeEqual(a, b)) {
        if (now - createdAt <= this.maxAgeSeconds * 1000) return true;
        this.sessions.delete(live);
        return false;
      }
    }
    return false;
  }

  private sweep(now: number): void {
    for (const [live, createdAt] of this.sessions) {
      if (now - createdAt > this.maxAgeSeconds * 1000) this.sessions.delete(live);
    }
  }
}
