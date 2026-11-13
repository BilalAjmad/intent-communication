/**
 * Output sanitisation for the HTML exporter.
 *
 * Every value that reaches the exported document passes through this module.
 * The exported file is opened directly by the user in a browser (the product's
 * main deliverable), so anything that survives here is script that runs in
 * the user's origin.
 *
 * References:
 * - trd 13.3  - exported HTML head, CSP meta
 * - trd 13.2  - closed CSS value grammar, assertSafeCssValue
 * - trd 13.5  - allowed image MIME types
 * - trd rule 8 - exports contain no external URLs except "#..." and data: images
 */

const CSS_VALUE_ALLOWLIST = /^[A-Za-z0-9#.,%()\-_+"' /]*$/;

/** MIME types allowed for inline data-URI images (trd 13.5). */
const ALLOWED_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** Maximum length of a data URI accepted into the export (trd 13.5). */
const MAX_DATA_URI_LENGTH = 5 * 1024 * 1024;

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Escapes a JSON string so it is safe to embed inside an HTML <script> block.
 *
 * JSON.stringify does not escape `<`, `>` or `&`. A scene value containing
 * "</script>" therefore closes the script element early and everything after
 * it is parsed as markup, which is a stored XSS in the exported prototype.
 * Escaping the three characters as \uXXXX keeps the JSON valid while making
 * the sequence unable to terminate the element.
 */
export function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Returns the value if it matches the closed CSS value grammar, otherwise an
 * empty string so the declaration is dropped entirely.
 *
 * trd 13.2: "CSS values are produced only by mapping functions from the
 * closed schema grammars. A final assertSafeCssValue check ... throws on
 * anything else."
 */
export function sanitizeCssValue(value: string): string {
  if (typeof value !== "string") return "";
  if (value.length > 512) return "";
  // url() can load an external resource and exfiltrate data.
  if (/url\s*\(/i.test(value)) return "";
  // Statement separators and block delimiters could add declarations or rules.
  if (/[;{}]/.test(value)) return "";
  // CSS escapes can smuggle any character past a naive check.
  if (value.includes("\\")) return "";
  if (!CSS_VALUE_ALLOWLIST.test(value)) return "";
  return value;
}

/**
 * Returns a value that is safe to use as a CSS class-name token.
 *
 * Used for values that the schema constrains with an enum. A schema union
 * that includes an unconstrained fallback accepts an invalid enum value, and
 * that raw value would otherwise be interpolated into a class attribute.
 */
export function safeClassToken(value: unknown, fallback: string): string {
  const s = typeof value === "string" ? value : "";
  if (s.length === 0 || s.length > 64) return fallback;
  return /^[A-Za-z0-9_-]+$/.test(s) ? s : fallback;
}

/**
 * Returns a URL that is safe to place in an href or src attribute.
 *
 * trd rule 8: "Exports contain no external URLs except href="#s-..." and
 * data: images." Everything else is replaced with an empty string.
 */
export function sanitizeUrl(url: unknown): string {
  const s = typeof url === "string" ? url.trim() : "";
  if (s.length === 0) return "";

  // Fragment links (screen navigation) are allowed.
  if (s.startsWith("#")) {
    return /^[#][A-Za-z0-9_-]*$/.test(s) ? s : "";
  }

  // Inline images are allowed, restricted to the allowed raster MIME types.
  if (s.toLowerCase().startsWith("data:")) {
    if (s.length > MAX_DATA_URI_LENGTH) return "";
    const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]*)$/i.exec(s);
    if (!match || !match[1]) return "";
    if (!ALLOWED_IMAGE_MIME.has(match[1].toLowerCase())) return "";
    return s;
  }

  // A relative path with no scheme is allowed.
  if (/^[A-Za-z0-9._\-/]+$/.test(s) && !s.includes("..")) {
    return s;
  }

  // Everything else - http, https, javascript, file, vbscript - is dropped.
  return "";
}

/**
 * Builds the Content-Security-Policy meta content for an exported document.
 *
 * trd 13.3: "CSP meta (default-src 'none'; style-src 'unsafe-inline';
 * script-src 'unsafe-inline'; img-src data:)".
 */
export function buildCsp(nonce: string): string {
  const scriptSrc = nonce ? `script-src 'unsafe-inline' 'nonce-${nonce}'` : "script-src 'unsafe-inline'";
  return [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    scriptSrc,
    "img-src data:",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}
