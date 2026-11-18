/**
 * Shared hex helpers for the linter (used by the token/contrast rules).
 * Accepts #rgb, #rrggbb (alpha is dropped); returns null for anything else.
 */
export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(hex);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3 || h.length === 4) {
    h = h.slice(0, 3).split("").map((c) => c + c).join("");
  } else if (h.length === 8) {
    h = h.slice(0, 6); // drop alpha
  }
  const n = (i: number) => parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return [n(0), n(1), n(2)];
}
