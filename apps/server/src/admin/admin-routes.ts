/** The merchant screen's sign-in, sign-out and home routes. Pages are escaped HTML; the home page grows in later tasks. */
import { resolveService } from "@the-market/core";
import type { HttpReply, ModuleRegistry } from "@the-market/core";
import { escapeHtml } from "@the-market/theme-engine";
import { describeError } from "../change-sets/item-steps.ts";
import { readCookie } from "../storefront/cart-pages.ts";
import type { Route, RouteRequest } from "../hono-adapter.ts";
import { composeAdminChangeSetRoutes } from "./admin-change-set.ts";
import { describeListener, renderConversation } from "./admin-conversation.ts";
import { composeAdminExperimentsAppsRoutes } from "./admin-experiments-apps.ts";
import type { CapabilityRegistry } from "@the-market/core";
import { buildSessionCookie, guardAdminRoutes, isOwnOrigin, readSessionSeconds, SESSION_COOKIE, sessionSecondsFor } from "./admin-session.ts";

type Matches = (request: { authorization: string; tenantId: string }) => Promise<boolean>;
type Summary = { changeSetId: string; title: string; state: string; proposedBy: string; itemCount: number };

/** One change set in a list: its title linking to its page, who proposed it, how many items, its state. */
export function renderChangeSetRow(summary: Summary): string {
  const items = summary.itemCount === 1 ? "1 item" : `${summary.itemCount} items`;
  return `<li><a href="/admin/change-sets/${encodeURIComponent(summary.changeSetId)}">${escapeHtml(summary.title)}</a> <span>${escapeHtml(summary.proposedBy)} · ${items} · ${escapeHtml(summary.state)}</span></li>`;
}

/** The home page: the store's name, what waits for approval, the rest of the recent change sets. */
export function renderHomeMain(input: { storeName: string; changeSets: Summary[]; renderRow: typeof renderChangeSetRow }): string {
  const waiting = input.changeSets.filter((summary) => summary.state === "draft");
  const others = input.changeSets.filter((summary) => summary.state !== "draft").slice(0, 10);
  const list = (summaries: Summary[], empty: string) => (summaries.length === 0 ? `<p>${empty}</p>` : `<ul>${summaries.map(input.renderRow).join("")}</ul>`);
  return `<h1>${escapeHtml(input.storeName)}</h1><nav><a href="/admin/experiments">Experiments</a> · <a href="/admin/apps">Apps</a></nav><h2>Waiting for approval (${waiting.length})</h2>${list(waiting, "Nothing is waiting.")}<h2>Recent</h2>${list(others, "No other change sets yet.")}`;
}

/** A whole admin page with a title, its main content, and the sign-out form. */
export function renderAdminPage(input: { title: string; mainHtml: string; signedIn: boolean }): string {
  const signOut = input.signedIn ? '<form method="post" action="/admin/sign-out"><button>Sign out</button></form>' : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title></head><body><header>${signOut}</header><main>${input.mainHtml}</main></body></html>`;
}

function replyPage(input: { status: number; html: string; headers?: Record<string, string> }): HttpReply {
  return { status: input.status, headers: { "content-type": "text/html; charset=utf-8", ...input.headers }, bodyText: input.html };
}

const SIGN_IN_FORM = '<h1>Sign in</h1><form method="post" action="/admin/sign-in"><label>Merchant token <input type="password" name="token" autocomplete="off" required></label><button>Sign in</button></form>';

export function composeAdminRoutes(input: { registry: ModuleRegistry; capabilities: CapabilityRegistry; matches: Matches; allowLocalHttp: boolean; readNow: () => number }): Route[] {
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
  const call = (moduleName: string, serviceName: string) => async (request: unknown) => (resolveService({ registry: input.registry, moduleName, serviceName }) as (request: unknown) => Promise<any>)(request);
  const showHome = async (request: RouteRequest, status: number, notice: string) => {
    const tenant = { tenantId: request.tenantId };
    const [storeName, changeSets, messages, connection] = await Promise.all([findStoreName(request.tenantId), call("changes", "listChangeSets")({ ...tenant, limit: 50 }), call("connections", "listMessages")({ ...tenant, limit: 20 }), call("connections", "findConnection")(tenant)]);
    const mainHtml = renderHomeMain({ storeName, changeSets, renderRow: renderChangeSetRow }) + renderConversation({ messages, connection, notice, describe: describeListener });
    return replyPage({ status, html: renderAdminPage({ title: "Store admin", mainHtml, signedIn: true }) });
  };
  const signedInRoutes = guardAdminRoutes({
    allowLocalHttp: input.allowLocalHttp,
    readToken,
    matches: input.matches,
    routes: [
      route("GET", "/admin", (request) => showHome(request, 200, "")),
      route("POST", "/admin/messages", async (request) =>
        call("connections", "sendMessage")({ tenantId: request.tenantId, text: String(new URLSearchParams(request.bodyText).get("text") ?? "") }).then(
          () => replyPage({ status: 303, html: "", headers: { location: "/admin" } }),
          (error: unknown) => showHome(request, 400, describeError(error)),
        ),
      ),
      ...composeAdminChangeSetRoutes({ registry: input.registry, capabilities: input.capabilities, renderPage: renderAdminPage }),
      ...composeAdminExperimentsAppsRoutes({ registry: input.registry, capabilities: input.capabilities, readNow: input.readNow, renderPage: renderAdminPage }),
      route("POST", "/admin/sign-out", async () => replyPage({ status: 303, html: "", headers: { location: "/admin/sign-in", "set-cookie": buildSessionCookie({ token: "", maxAgeSeconds: 0, secure }) } })),
    ],
  });
  return [route("GET", "/admin/sign-in", async () => replyPage({ status: 200, html: renderAdminPage({ title: "Sign in", mainHtml: SIGN_IN_FORM, signedIn: false }) })), route("POST", "/admin/sign-in", signIn), ...signedInRoutes];
}
