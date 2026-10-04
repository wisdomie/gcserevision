/**
 * Returns `path` if it is a same-site relative path, otherwise the fallback.
 * Rejects protocol-relative ("//evil.com") and backslash ("/\evil.com") forms,
 * which URL parsers resolve to another host.
 */
export function safeRedirectPath(path: string | null | undefined, fallback = "/play"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || /[\\\s]/.test(path))
    return fallback;
  try {
    const url = new URL(path, "http://same.site");
    return url.host === "same.site" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
