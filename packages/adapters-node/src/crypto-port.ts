import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { CryptoPort } from "@intent/core";

/** Node crypto port for the MCP/CLI surfaces (hash/verify are SHA-256). */
export function createNodeCryptoPort(): CryptoPort {
  return {
    generateId(): string {
      // UUIDv7-conformant: 48-bit unix ms, version nibble 7, variant 0b10.
      const ts = BigInt(Date.now());
      const bytes = randomBytes(16);
      bytes[0] = Number((ts >> 40n) & 0xffn);
      bytes[1] = Number((ts >> 32n) & 0xffn);
      bytes[2] = Number((ts >> 24n) & 0xffn);
      bytes[3] = Number((ts >> 16n) & 0xffn);
      bytes[4] = Number((ts >> 8n) & 0xffn);
      bytes[5] = Number(ts & 0xffn);
      bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
      bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
      const hex = bytes.toString("hex");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    },
    async hash(input: string): Promise<string> {
      return createHash("sha256").update(input).digest("hex");
    },
    async verify(input: string, hash: string): Promise<boolean> {
      const computed = await this.hash(input);
      const a = Buffer.from(computed, "utf8");
      const b = Buffer.from(hash, "utf8");
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    },
  };
}
