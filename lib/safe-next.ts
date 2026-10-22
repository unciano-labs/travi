// Validates a post-login "return to" path. Pure (no server APIs), so the edge middleware,
// route handlers, Server Actions and client components can all share it.
//
// Only same-site relative paths are allowed: must start with "/" but not "//" or "/\"
// (browsers treat both as protocol-relative URLs), no control characters, bounded length.
const PLACEHOLDER_ORIGIN = 'http://travi.invalid';

export function safeNextPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > 512) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;

  try {
    const url = new URL(raw, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return null;
    const path = `${url.pathname}${url.search}${url.hash}`;
    // Dot-segments can normalise into "//host" (e.g. "/..//evil.com"): re-check the result.
    return path.startsWith('//') ? null : path;
  } catch {
    return null;
  }
}
