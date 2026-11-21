import type { CryptoPort } from "./port-types.js";

export function createCryptoPort(): CryptoPort {
  return {
    generateId(): string {
      // UUIDv7-conformant: 48-bit unix ms, version nibble 7, variant 0b10,
      // remaining bits from Web Crypto (works in Node >= 19 and browsers).
      const ts = BigInt(Date.now());
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[0] = Number((ts >> 40n) & 0xffn);
      bytes[1] = Number((ts >> 32n) & 0xffn);
      bytes[2] = Number((ts >> 24n) & 0xffn);
      bytes[3] = Number((ts >> 16n) & 0xffn);
      bytes[4] = Number((ts >> 8n) & 0xffn);
      bytes[5] = Number(ts & 0xffn);
      bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70;
      bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    },
    async hash(input: string): Promise<string> {
      const msg = new TextEncoder().encode(input);
      const hash = await crypto.subtle.digest("SHA-256", msg);
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    },
    async verify(input: string, hash: string): Promise<boolean> {
      const computed = await createCryptoPort().hash(input);
      if (computed.length !== hash.length) return false;
      // Constant-time compare — do not early-exit on the first mismatch.
      let diff = 0;
      for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
      return diff === 0;
    },
  };
}
