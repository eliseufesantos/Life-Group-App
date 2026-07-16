/**
 * True only for absolute http(s) URLs. Rejects dangerous schemes such as
 * `javascript:` and `data:` that would otherwise be stored and later rendered
 * in an `href`, enabling stored XSS. Used to validate user-supplied links
 * (album Drive folders, campaign external links) on the backend, since the
 * frontend checks are advisory and bypassable via direct API calls.
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
