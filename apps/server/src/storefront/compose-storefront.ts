/** Composition of the storefront routes: the only place their concrete functions are wired. */
import { resolveService } from "@the-market/core";
import type { ModuleRegistry } from "@the-market/core";
import { DEFAULT_PAGES, DEFAULT_SECTIONS, escapeHtml, formatPrice, readSettingText, renderPage, wrapDocument } from "@the-market/theme-engine";
import type { Route } from "../hono-adapter.ts";
import { handleHomePage, handleProductPage, renderStorePage } from "./storefront-handlers.ts";
import type { StorefrontSteps } from "./storefront-handlers.ts";
import { readCookie } from "./cart-pages.ts";
import { recordKnownVisitor, recordQuietly, serveVisitorPage, VISITOR_COOKIE } from "./visitor-telemetry.ts";
import type { StoreEvent } from "./visitor-telemetry.ts";
import type { RouteRequest } from "../hono-adapter.ts";
import type { HttpReply } from "@the-market/core";

/** Events go to the experiments module when it is loaded; without it, or when it fails, nothing is recorded. */
export function buildEventRecorder(registry: ModuleRegistry): (event: StoreEvent) => void {
  const record = (event: StoreEvent) => (resolveService({ registry, moduleName: "experiments", serviceName: "recordEvent" }) as (event: StoreEvent) => Promise<void>)(event);
  return (event) => recordKnownVisitor({ event, record: (known) => recordQuietly({ record, event: known }) });
}

/** The storefront's reading and rendering steps over the loaded modules. */
export function buildStorefrontSteps(input: { registry: ModuleRegistry }): StorefrontSteps {
  const service = (moduleName: string, serviceName: string) => resolveService({ registry: input.registry, moduleName, serviceName });
  const findTenant = service("tenancy", "findTenant") as (request: { tenantId: string }) => Promise<{ name: string } | undefined>;
  const steps: StorefrontSteps = {
    findStoreName: async (request) => (await findTenant(request))?.name ?? "",
    listProducts: service("catalog", "listProducts") as StorefrontSteps["listProducts"],
    findPage: service("pages", "findPage") as StorefrontSteps["findPage"],
    defaultPages: DEFAULT_PAGES,
    toCard: (product) => ({ productId: product.productId, handle: product.handle, title: product.title, priceText: formatPrice(product) }),
    render: (request) => renderPage({ ...request, definitions: DEFAULT_SECTIONS, escape: escapeHtml, readText: readSettingText, wrap: wrapDocument }),
  };
  return steps;
}

export function composeStorefrontRoutes(input: { registry: ModuleRegistry }): Route[] {
  const steps = buildStorefrontSteps(input);
  const record = buildEventRecorder(input.registry);
  const visit = (request: RouteRequest, pageKey: string, run: () => Promise<HttpReply>) =>
    serveVisitorPage({ tenantId: request.tenantId, pageKey, cookieValue: readCookie({ cookieHeader: String(request.headerValues.cookie ?? ""), cookieName: VISITOR_COOKIE }), createKey: () => crypto.randomUUID(), run, record });
  return [
    { method: "GET", path: "/", tenantScoped: true, handleRequest: (request) => visit(request, "home", () => handleHomePage({ tenantId: request.tenantId, steps, renderPage: renderStorePage })) },
    {
      method: "GET",
      path: "/products/:handle",
      tenantScoped: true,
      handleRequest: (request) =>
        visit(request, "product", () => handleProductPage({ tenantId: request.tenantId, handle: String(request.pathParams.handle), steps, renderPage: renderStorePage })),
    },
  ];
}
