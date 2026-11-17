/**
 * Composition root of the server: wires the routes to the loaded modules.
 * It takes the module registry and capabilities as input, so tests can pass fakes.
 */
import { resolveService } from "@the-market/core";
import type { CapabilityRegistry, ModuleRegistry } from "@the-market/core";
import { Hono } from "hono";
import { handleListCapabilities } from "./capabilities-handler.ts";
import { composeChangeSetRoutes } from "./change-sets/compose-change-sets.ts";
import { handleHealth } from "./health-handler.ts";
import { answerWithRoute, mountRoutes } from "./hono-adapter.ts";
import { guardMerchantRoutes, matchesMerchantToken } from "./merchant-token.ts";
import { handleListProducts } from "./products-handler.ts";
import type { Route } from "./hono-adapter.ts";

type ResolveTenantService = (input: { host: string }) => Promise<string | undefined>;
type ListProductsService = (input: { tenantId: string }) => Promise<unknown[]>;

export async function composeServer(input: {
  readUptime: () => number;
  registry: ModuleRegistry;
  capabilities: CapabilityRegistry;
  /** Enables the merchant routes. Empty means they are not mounted. */
  merchantToken: string;
}): Promise<Hono> {
  const resolveTenantService = resolveService({
    registry: input.registry,
    moduleName: "tenancy",
    serviceName: "resolveTenant",
  }) as ResolveTenantService;
  const listProductsService = resolveService({
    registry: input.registry,
    moduleName: "catalog",
    serviceName: "listProducts",
  }) as ListProductsService;
  const routes: Route[] = [
    {
      method: "GET",
      path: "/health",
      tenantScoped: false,
      handleRequest: () =>
        handleHealth({ moduleNames: Object.keys(input.registry), readUptime: input.readUptime }),
    },
    {
      method: "GET",
      path: "/api/products",
      tenantScoped: true,
      handleRequest: (request) =>
        handleListProducts({ tenantId: request.tenantId, listProducts: listProductsService }),
    },
    {
      method: "GET",
      path: "/api/capabilities",
      tenantScoped: false,
      handleRequest: () => handleListCapabilities({ capabilities: input.capabilities }),
    },
  ];
  const merchantRoutes =
    input.merchantToken === "" ? [] : composeChangeSetRoutes({ registry: input.registry, capabilities: input.capabilities });
  return mountRoutes({
    app: new Hono(),
    routes: [
      ...routes,
      ...guardMerchantRoutes({ routes: merchantRoutes, merchantToken: input.merchantToken, matches: matchesMerchantToken }),
    ],
    answerRoute: answerWithRoute,
    resolveTenant: (host) => resolveTenantService({ host }),
  });
}
