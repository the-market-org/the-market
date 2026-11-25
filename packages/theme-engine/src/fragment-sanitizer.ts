/**
 * Sanitizer for app-supplied HTML: the fragment is parsed by an HTML parser and rebuilt from an allowlist.
 * Unknown elements are unwrapped (their content stays), dangerous ones are dropped with their content,
 * and only listed attributes survive. Links and images must point to https or to the store itself.
 */
import { parseFragment, serialize } from "parse5";

type ParsedNode = { nodeName: string; attrs?: Array<{ name: string; value: string }>; childNodes?: ParsedNode[] };

const ALLOWED_TAGS: ReadonlySet<string> = new Set(["p", "div", "span", "strong", "em", "ul", "ol", "li", "a", "img", "h2", "h3", "h4", "br", "button"]);
const DROPPED_WITH_CONTENT: ReadonlySet<string> = new Set(["script", "style", "template", "iframe", "object", "embed", "svg", "math", "noscript", "textarea", "select", "title"]);
const ALLOWED_ATTRIBUTES: ReadonlySet<string> = new Set(["class", "id", "href", "src", "alt", "title", "hx-get", "hx-target", "hx-swap"]);
const URL_ATTRIBUTES: ReadonlySet<string> = new Set(["href", "src"]);
const HTMX_REQUEST = /\shx-(?:get|post|put|patch|delete)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const ATTRIBUTE_START = /^[^=]*=\s*["']?/;
const CLOSING_QUOTE = /["']$/;

/** True for an https address or a path on the store itself (not `//host`), after the parser has decoded it. */
export function isSafeUrl(value: string): boolean {
  const address = value.replace(/[\u0000-\u0020]/g, "").toLowerCase();
  return address.startsWith("https://") || (address.startsWith("/") && !address.startsWith("//"));
}

/** Keeps listed attributes only, and URL attributes only when they are safe. */
export function keepAttributes(attributes: Array<{ name: string; value: string }>): Array<{ name: string; value: string }> {
  const listed = attributes.filter((attribute) => ALLOWED_ATTRIBUTES.has(attribute.name));
  return listed.filter((attribute) => !URL_ATTRIBUTES.has(attribute.name) || isSafeUrl(attribute.value));
}

/** What a node becomes: nothing, its cleaned children (unwrapped), or itself with cleaned attributes and children. */
export function cleanNode(node: ParsedNode): ParsedNode[] {
  const isText = node.nodeName === "#text";
  const kept = isText || ALLOWED_TAGS.has(node.nodeName);
  return DROPPED_WITH_CONTENT.has(node.nodeName) || node.nodeName === "#comment" ? [] : kept ? [keepElement(node)] : cleanChildren(node);
}

function keepElement(node: ParsedNode): ParsedNode {
  return node.attrs === undefined ? node : Object.assign(node, { attrs: keepAttributes(node.attrs), childNodes: cleanChildren(node) });
}

function cleanChildren(node: ParsedNode): ParsedNode[] {
  return (node.childNodes ?? []).flatMap(cleanNode);
}

/** Parses the fragment, keeps only allowlisted elements and attributes, and serialises it with the parser. */
export function stripActiveContent(html: string): string {
  const fragment = parseFragment(html) as unknown as ParsedNode;
  fragment.childNodes = cleanChildren(fragment);
  return serialize(fragment as never);
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
