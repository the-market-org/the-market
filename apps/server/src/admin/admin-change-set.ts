/**
 * The merchant screen's change set page: its items, a sandboxed preview of each page it changes, and the moves
 * its state allows. Actions are plain forms through the same workflows as the merchant API.
 */
import { resolveService } from "@the-market/core";
import type { CapabilityRegistry, HttpReply, ModuleRegistry } from "@the-market/core";
import type { ChangeSetRecord } from "@the-market/module-changes";
import { escapeHtml } from "@the-market/theme-engine";
import { answerChangeSetError } from "../change-sets/change-set-http.ts";
import { buildChangeSetDecisions } from "../change-sets/compose-change-sets.ts";
import { describeError } from "../change-sets/item-steps.ts";
import type { Route, RouteRequest } from "../hono-adapter.ts";
import { buildStorefrontSteps } from "../storefront/compose-storefront.ts";
import { findPreviewSections, handlePreview } from "../storefront/preview-handler.ts";
import { renderStorePage } from "../storefront/storefront-handlers.ts";

const MOVES_BY_STATE: Readonly<Record<string, readonly string[]>> = Object.freeze({ draft: ["approve", "reject"], approved: ["apply"], applied: ["revert"] });

/** The keys of the pages a change set's items set, in order, once each. */
export function listPreviewPages(changeSet: ChangeSetRecord): string[] {
  const pageKeys = changeSet.items.filter((item) => item.capabilityName === "pages.page.set-sections").map((item) => String((item.change as { pageKey?: unknown }).pageKey));
  return [...new Set(pageKeys)];
}

/** The page's main content: details, items, previews, then a form for each move its state allows. */
export function renderChangeSetMain(input: { changeSet: ChangeSetRecord; notice: string }): string {
  const { changeSet } = input;
  const base = `/admin/change-sets/${encodeURIComponent(changeSet.changeSetId)}`;
  const notice = input.notice === "" ? "" : `<p role="alert">${escapeHtml(input.notice)}</p>`;
  const items = changeSet.items.map((item) => `<li>${escapeHtml(item.summary)}</li>`).join("");
  const previews = listPreviewPages(changeSet).map((pageKey) => `<iframe sandbox src="${base}/preview/${encodeURIComponent(pageKey)}" title="Preview of ${escapeHtml(pageKey)}"></iframe>`).join("");
  const moves = (MOVES_BY_STATE[changeSet.state] ?? []).map((move) => `<form method="post" action="${base}/${move}"><button>${move[0]?.toUpperCase()}${move.slice(1)}</button></form>`).join("");
  return `<p><a href="/admin">All change sets</a></p><h1>${escapeHtml(changeSet.title)}</h1>${notice}<p>Proposed by ${escapeHtml(changeSet.proposedBy)} · ${escapeHtml(changeSet.state)}</p><ol>${items}</ol>${previews}${moves}`;
}

export function composeAdminChangeSetRoutes(input: {
  registry: ModuleRegistry;
  capabilities: CapabilityRegistry;
  renderPage: (page: { title: string; mainHtml: string; signedIn: boolean }) => string;
}): Route[] {
  const decisions = buildChangeSetDecisions(input);
  const findSet = (request: RouteRequest) => (resolveService({ registry: input.registry, moduleName: "changes", serviceName: "findChangeSet" }) as (keys: { tenantId: string; changeSetId: string }) => Promise<ChangeSetRecord | undefined>)({ tenantId: request.tenantId, changeSetId: String(request.pathParams.changeSetId) });
  const reply = (status: number, html: string, headers: Record<string, string> = {}): HttpReply => ({ status, headers: { "content-type": "text/html; charset=utf-8", ...headers }, bodyText: html });
  const showSet = async (request: RouteRequest, status: number, notice: string) => {
    const changeSet = await findSet(request);
    return changeSet === undefined
      ? reply(404, input.renderPage({ title: "Not found", mainHtml: "<h1>Change set not found</h1>", signedIn: true }))
      : reply(status, input.renderPage({ title: changeSet.title, mainHtml: renderChangeSetMain({ changeSet, notice }), signedIn: true }));
  };
  const keysOf = (request: RouteRequest) => ({ tenantId: request.tenantId, changeSetId: String(request.pathParams.changeSetId) });
  const runMove = (move: (request: RouteRequest) => Promise<void>) => async (request: RouteRequest) =>
    move(request).then(
      () => reply(303, "", { location: `/admin/change-sets/${encodeURIComponent(String(request.pathParams.changeSetId))}` }),
      async (error: unknown) => {
        const message = describeError(error);
        return showSet(request, answerChangeSetError(message).status, message);
      },
    );
  const route = (method: Route["method"], path: string, handle: Route["handleRequest"]): Route => ({ method, path, tenantScoped: true, handleRequest: handle });
  const storefrontSteps = buildStorefrontSteps({ registry: input.registry });
  return [
    route("GET", "/admin/change-sets/:changeSetId", (request) => showSet(request, 200, "")),
    route("GET", "/admin/change-sets/:changeSetId/preview/:pageKey", (request) =>
      handlePreview({ ...keysOf(request), pageKey: String(request.pathParams.pageKey), handle: request.queryValues.handle ?? "", findSet: async () => findSet(request), findSections: findPreviewSections, steps: storefrontSteps, renderPage: renderStorePage }).catch((error: unknown) => answerChangeSetError(describeError(error))),
    ),
    route("POST", "/admin/change-sets/:changeSetId/approve", runMove((request) => decisions.approve({ ...keysOf(request), approvedBy: "merchant screen" }))),
    route("POST", "/admin/change-sets/:changeSetId/reject", runMove((request) => decisions.reject(keysOf(request)))),
    route("POST", "/admin/change-sets/:changeSetId/apply", runMove((request) => decisions.apply(keysOf(request)))),
    route("POST", "/admin/change-sets/:changeSetId/revert", runMove((request) => decisions.revert(keysOf(request)))),
  ];
}
