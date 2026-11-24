/** Composition of the storefront routes: the only place their concrete functions are wired. */
import { resolveService } from "@the-market/core";
import type { ModuleRegistry } from "@the-market/core";
import { DEFAULT_PAGES, DEFAULT_SECTIONS, escapeHtml, formatPrice, readSettingText, renderPage } from "@the-market/theme-engine";
import type { Route } from "../hono-adapter.ts";
import { handleHomePage, handleProductPage, renderStorePage } from "./storefront-handlers.ts";
import type { StorefrontSteps } from "./storefront-handlers.ts";

/** The storefront's reading and rendering steps over the loaded modules. */
export function buildStorefrontSteps(input: { registry: ModuleRegistry }): StorefrontSteps {
  const service = (moduleName: string, serviceName: string) => resolveService({ registry: input.registry, moduleName, serviceName });
  const findTenant = service("tenancy", "findTenant") as (request: { tenantId: string }) => Promise<{ name: string } | undefined>;
  const steps: StorefrontSteps = {
    findStoreName: async (request) => (await findTenant(request))?.name ?? "",
    listProducts: service("catalog", "listProducts") as StorefrontSteps["listProducts"],
    findPage: service("pages", "findPage") as StorefrontSteps["findPage"],
    defaultPages: DEFAULT_PAGES,
    toCard: (product) => ({ handle: product.handle, title: product.title, priceText: formatPrice(product) }),
    render: (request) => renderPage({ ...request, definitions: DEFAULT_SECTIONS, escape: escapeHtml, readText: readSettingText }),
  };
  return steps;
}

export function composeStorefrontRoutes(input: { registry: ModuleRegistry }): Route[] {
  const steps = buildStorefrontSteps(input);
  return [
    { method: "GET", path: "/", tenantScoped: true, handleRequest: (request) => handleHomePage({ tenantId: request.tenantId, steps, renderPage: renderStorePage }) },
    {
      method: "GET",
      path: "/products/:handle",
      tenantScoped: true,
      handleRequest: (request) =>
        handleProductPage({ tenantId: request.tenantId, handle: String(request.pathParams.handle), steps, renderPage: renderStorePage }),
    },
  ];
}
