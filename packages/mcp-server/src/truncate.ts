/**
 * Byte-accurate response truncation for MCP payloads. Cut the UTF-8 encoding,
 * never a UTF-16 code-unit boundary, and never return a fake half-parsed value:
 * a number cut mid-digits re-parses cleanly (123456 → 1234), so structs only.
 */
export function truncateToBytes(obj: unknown, maxBytes: number): { data: unknown; truncated: boolean } {
  const str = JSON.stringify(obj);
  if (Buffer.byteLength(str, "utf-8") <= maxBytes) {
    return { data: obj, truncated: false };
  }
  const buf = Buffer.from(str, "utf-8").subarray(0, maxBytes);
  const text = buf.toString("utf-8"); // may end mid-codepoint; JSON.parse rejects it cleanly
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
    // Only structured (object/array) results are accepted as "partial but honest".
    if (parsed === null || typeof parsed !== "object") {
      throw new Error("truncated primitive would be corrupted");
    }
  } catch {
    parsed = {
      _truncated: true,
      message: `Response exceeds ${maxBytes} bytes; narrow the query (objectIds/depth/maxBytes) and retry.`,
    };
  }
  return { data: parsed, truncated: true };
}
