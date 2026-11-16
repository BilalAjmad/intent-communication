import type { CryptoPort } from "./port-types.js";

export function createCryptoPort(): CryptoPort {
  return {
    generateId(): string {
      const now = Date.now();
      const timeHigh = now.toString(16).padStart(12, "0");
      const timeLow = Math.floor(Math.random() * 0x1000).toString(16).padStart(3, "0");
      const version = "7";
      const clockSeq = Math.floor(Math.random() * 0x4000).toString(16).padStart(4, "0");
      const node = Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      return `${timeHigh.slice(0, 8)}-${timeHigh.slice(8)}-${version}${timeLow}-${clockSeq}-${node}`;
    },
    async hash(input: string): Promise<string> {
      const msg = new TextEncoder().encode(input);
      const hash = await crypto.subtle.digest("SHA-256", msg);
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    },
    async verify(input: string, hash: string): Promise<boolean> {
      const computed = await createCryptoPort().hash(input);
      return computed === hash;
    },
  };
}
