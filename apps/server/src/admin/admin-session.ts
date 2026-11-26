/**
 * The merchant screen's session. A browser cannot send a bearer header, so sign-in exchanges the merchant's
 * token for an HttpOnly, SameSite=Strict cookie limited to /admin. Every request checks the cookie's token
 * exactly as the merchant API checks a bearer token, and every POST must come from the store's own origin.
 */
import type { HttpReply } from "@the-market/core";
import type { Route, RouteRequest } from "../hono-adapter.ts";

export const SESSION_COOKIE = "merchant_session";
const SHARED_TOKEN_SECONDS = 12 * 3600;

/** Seconds until the token's `exp`, or 12 hours for the shared development token, never less than 0. */
export function readSessionSeconds(input: { token: string; nowSeconds: number }): number {
  const claims = JSON.parse(Buffer.from(String(input.token.split(".")[1] ?? ""), "base64url").toString("utf8") || "{}") as { exp?: unknown };
  return typeof claims.exp === "number" ? Math.max(0, claims.exp - input.nowSeconds) : SHARED_TOKEN_SECONDS;
}

/** The safe reading of a token's lifetime: a token that is not JSON inside counts as the shared token. */
export function sessionSecondsFor(input: { token: string; nowSeconds: number; read: typeof readSessionSeconds }): number {
  try {
    return input.read(input);
  } catch {
    return SHARED_TOKEN_SECONDS;
  }
}

export function buildSessionCookie(input: { token: string; maxAgeSeconds: number; secure: boolean }): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(input.token)}; Path=/admin; HttpOnly; SameSite=Strict${input.secure ? "; Secure" : ""}; Max-Age=${input.maxAgeSeconds}`;
}

/** True when the request's Origin is this store's own: https, or http as well in development. */
export function isOwnOrigin(input: { origin: string; host: string; allowLocalHttp: boolean }): boolean {
  const allowed = input.allowLocalHttp ? [`https://${input.host}`, `http://${input.host}`] : [`https://${input.host}`];
  return allowed.includes(input.origin);
}

function replyStatus(input: { status: number; body: string; headers?: Record<string, string> }): HttpReply {
  return { status: input.status, headers: { "content-type": "text/plain; charset=utf-8", ...input.headers }, bodyText: input.body };
}

/** The answer for a request the session does not let in: a page goes to sign-in, an action is refused. */
export function refuseRequest(method: string): HttpReply {
  return method === "GET" ? replyStatus({ status: 303, body: "", headers: { location: "/admin/sign-in" } }) : replyStatus({ status: 401, body: "Sign in again" });
}

/** Wraps admin routes: a POST from another origin is 403; a request without a good session is refused. */
export function guardAdminRoutes(input: {
  routes: Route[];
  allowLocalHttp: boolean;
  readToken: (request: RouteRequest) => string;
  matches: (request: { authorization: string; tenantId: string }) => Promise<boolean>;
}): Route[] {
  return input.routes.map((route) => ({
    ...route,
    handleRequest: async (request) => {
      const ownOrigin = route.method === "GET" || isOwnOrigin({ origin: String(request.headerValues.origin ?? ""), host: String(request.headerValues.host ?? ""), allowLocalHttp: input.allowLocalHttp });
      const signedIn = ownOrigin && (await input.matches({ authorization: `Bearer ${input.readToken(request)}`, tenantId: request.tenantId }));
      return ownOrigin ? (signedIn ? route.handleRequest(request) : refuseRequest(route.method)) : replyStatus({ status: 403, body: "Forbidden" });
    },
  }));
}
