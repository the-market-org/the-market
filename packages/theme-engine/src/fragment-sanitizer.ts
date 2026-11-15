/**
 * Skeleton sanitizer for app-supplied HTML.
 * It is regex based to stay dependency free. Before any production use it
 * must be replaced by a parser-based allowlist sanitizer behind the same
 * function signatures (tracked in the prototype plan).
 */
const SCRIPT_BLOCK = /<script\b[\s\S]*?<\/script\s*>/gi;
const ACTIVE_TAG = /<\/?(script|iframe|object|embed|link|meta|base|style|form)\b[^>]*>/gi;
const INLINE_HANDLER = /\s(on[a-z]+|hx-on[:\w-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const SCRIPT_URL = /\s(href|src|action)\s*=\s*("\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]*)/gi;
const HTMX_REQUEST = /\shx-(?:get|post|put|patch|delete)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const ATTRIBUTE_START = /^[^=]*=\s*["']?/;
const CLOSING_QUOTE = /["']$/;

/** Removes scripts, active tags, inline event handlers and javascript: URLs. */
export function stripActiveContent(html: string): string {
  return html
    .replace(SCRIPT_BLOCK, "")
    .replace(ACTIVE_TAG, "")
    .replace(INLINE_HANDLER, "")
    .replace(SCRIPT_URL, "");
}

/** Drops any htmx request attribute that points outside the app's own URL prefix. */
export function scopeHtmxRequests(input: { html: string; allowedPrefix: string }): string {
  return input.html.replace(HTMX_REQUEST, (attributeText: string) => {
    const requestUrl = attributeText.replace(ATTRIBUTE_START, "").replace(CLOSING_QUOTE, "");
    return requestUrl.startsWith(input.allowedPrefix) ? attributeText : "";
  });
}

/** Full cleaning pass for one app's fragment. */
export function cleanFragment(input: {
  html: string;
  appId: string;
  stripContent: (html: string) => string;
  scopeRequests: (input: { html: string; allowedPrefix: string }) => string;
}): string {
  return input.scopeRequests({
    html: input.stripContent(input.html),
    allowedPrefix: `/apps/${input.appId}/`,
  });
}
