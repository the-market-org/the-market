/**
 * Response headers every reply carries. HTML pages get a strict content security policy: no inline
 * scripts or handlers, scripts only from the store's own origin, no plugins, no foreign framing or forms.
 */
export const CONTENT_SECURITY_POLICY = "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'";

/** The reply's headers with the security headers added; a page's own values are kept. */
export function addSecurityHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  const isPage = String(headers["content-type"] ?? "").startsWith("text/html");
  const pageHeaders: Record<string, string> = isPage ? { "content-security-policy": CONTENT_SECURITY_POLICY, "referrer-policy": "same-origin" } : {};
  return { "x-content-type-options": "nosniff", ...pageHeaders, ...headers };
}
