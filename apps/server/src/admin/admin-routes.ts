/** The merchant screen's sign-in, sign-out and home routes. Pages are escaped HTML; the home page grows in later tasks. */
import { resolveService } from "@the-market/core";
import type { HttpReply, ModuleRegistry } from "@the-market/core";
import { escapeHtml } from "@the-market/theme-engine";
import { readCookie } from "../storefront/cart-pages.ts";
import type { Route, RouteRequest } from "../hono-adapter.ts";
import { buildSessionCookie, guardAdminRoutes, isOwnOrigin, readSessionSeconds, SESSION_COOKIE, sessionSecondsFor } from "./admin-session.ts";

type Matches = (request: { authorization: string; tenantId: string }) => Promise<boolean>;

/** A whole admin page with a title, its main content, and the sign-out form. */
export function renderAdminPage(input: { title: string; mainHtml: string; signedIn: boolean }): string {
  const signOut = input.signedIn ? '<form method="post" action="/admin/sign-out"><button>Sign out</button></form>' : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title></head><body><header>${signOut}</header><main>${input.mainHtml}</main></body></html>`;
}

function replyPage(input: { status: number; html: string; headers?: Record<string, string> }): HttpReply {
  return { status: input.status, headers: { "content-type": "text/html; charset=utf-8", ...input.headers }, bodyText: input.html };
}

const SIGN_IN_FORM = '<h1>Sign in</h1><form method="post" action="/admin/sign-in"><label>Merchant token <input type="password" name="token" autocomplete="off" required></label><button>Sign in</button></form>';

export function composeAdminRoutes(input: { registry: ModuleRegistry; matches: Matches; allowLocalHttp: boolean; readNow: () => number }): Route[] {
  const secure = !input.allowLocalHttp;
  const findStoreName = async (tenantId: string) => String(((await (resolveService({ registry: input.registry, moduleName: "tenancy", serviceName: "findTenant" }) as (request: { tenantId: string }) => Promise<{ name?: string } | undefined>)({ tenantId })) ?? {}).name ?? "");
  const readToken = (request: RouteRequest) => readCookie({ cookieHeader: String(request.headerValues.cookie ?? ""), cookieName: SESSION_COOKIE });
  const ownOrigin = (request: RouteRequest) => isOwnOrigin({ origin: String(request.headerValues.origin ?? ""), host: String(request.headerValues.host ?? ""), allowLocalHttp: input.allowLocalHttp });
  const route = (method: Route["method"], path: string, handle: Route["handleRequest"]): Route => ({ method, path, tenantScoped: true, handleRequest: handle });
  const signIn = async (request: RouteRequest): Promise<HttpReply> => {
    const token = String(new URLSearchParams(request.bodyText).get("token") ?? "");
    const accepted = ownOrigin(request) && (await input.matches({ authorization: `Bearer ${token}`, tenantId: request.tenantId }));
    const cookie = () => buildSessionCookie({ token, maxAgeSeconds: sessionSecondsFor({ token, nowSeconds: Math.floor(input.readNow() / 1000), read: readSessionSeconds }), secure });
    return accepted
      ? replyPage({ status: 303, html: "", headers: { location: "/admin", "set-cookie": cookie() } })
      : replyPage({ status: 401, html: renderAdminPage({ title: "Sign in", mainHtml: `<p>That token is not accepted for this store.</p>${SIGN_IN_FORM}`, signedIn: false }) });
  };
  const signedInRoutes = guardAdminRoutes({
    allowLocalHttp: input.allowLocalHttp,
    readToken,
    matches: input.matches,
    routes: [
      route("GET", "/admin", async (request) => replyPage({ status: 200, html: renderAdminPage({ title: "Store admin", mainHtml: `<h1>${escapeHtml(await findStoreName(request.tenantId))}</h1>`, signedIn: true }) })),
      route("POST", "/admin/sign-out", async () => replyPage({ status: 303, html: "", headers: { location: "/admin/sign-in", "set-cookie": buildSessionCookie({ token: "", maxAgeSeconds: 0, secure }) } })),
    ],
  });
  return [route("GET", "/admin/sign-in", async () => replyPage({ status: 200, html: renderAdminPage({ title: "Sign in", mainHtml: SIGN_IN_FORM, signedIn: false }) })), route("POST", "/admin/sign-in", signIn), ...signedInRoutes];
}
