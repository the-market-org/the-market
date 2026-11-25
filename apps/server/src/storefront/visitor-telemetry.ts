/**
 * Anonymous storefront telemetry: a random `visitor_id` cookie, and events that never delay or break a page.
 * No IP address, user agent or account is recorded.
 */
import type { HttpReply } from "@the-market/core";

export type StoreEvent = { tenantId: string; visitorKey: string; eventName: string; pageKey: string };

export const VISITOR_COOKIE = "visitor_id";
const VISITOR_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The visitor's key from the cookie, or a new one when the cookie is missing or not a key we made. */
export function readVisitorKey(input: { cookieValue: string; createKey: () => string }): { visitorKey: string; isNew: boolean } {
  const known = VISITOR_PATTERN.test(input.cookieValue);
  return { visitorKey: known ? input.cookieValue : input.createKey(), isNew: !known };
}

export function buildVisitorCookie(input: { visitorKey: string; attributes: string }): string {
  return `${VISITOR_COOKIE}=${input.visitorKey}; ${input.attributes}; Max-Age=31536000`;
}

/** Starts the write and returns at once; a failed write is dropped. */
export function recordQuietly(input: { record: (event: StoreEvent) => Promise<unknown>; event: StoreEvent }): void {
  void Promise.resolve()
    .then(() => input.record(input.event))
    .catch(() => undefined);
}

/** Serves a storefront page for a visitor: records a view of a found page and sets the cookie on a first visit. */
export async function serveVisitorPage(input: {
  tenantId: string;
  pageKey: string;
  cookieValue: string;
  createKey: () => string;
  run: (visitorKey: string) => Promise<HttpReply>;
  record: (event: StoreEvent) => void;
  cookieAttributes: string;
}): Promise<HttpReply> {
  const visitor = readVisitorKey({ cookieValue: input.cookieValue, createKey: input.createKey });
  const reply = await input.run(visitor.visitorKey);
  const found = reply.status === 200;
  input.record({ tenantId: input.tenantId, visitorKey: found ? visitor.visitorKey : "", eventName: "page_view", pageKey: input.pageKey });
  return visitor.isNew ? { ...reply, headers: { ...reply.headers, "set-cookie": buildVisitorCookie({ visitorKey: visitor.visitorKey, attributes: input.cookieAttributes }) } } : reply;
}

/** Passes on events of known visitors only: a request without a visitor key records nothing. */
export function recordKnownVisitor(input: { event: StoreEvent; record: (event: StoreEvent) => void }): void {
  if (input.event.visitorKey !== "") {
    input.record(input.event);
  }
}
