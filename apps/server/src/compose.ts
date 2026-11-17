/**
 * Composition root of the server: wires the routes to the loaded modules.
 * It takes the module registry as input, so tests can pass a fake one.
 */
import { resolveService } from "@the-market/core";
import type { ModuleRegistry } from "@the-market/core";
import { Hono } from "hono";
import { handleHealth } from "./health-handler.ts";
import { answerWithRoute, mountRoutes } from "./hono-adapter.ts";
import { handleListProducts } from "./products-handler.ts";
import type { Route } from "./hono-adapter.ts";

type ResolveTenantService = (input: { host: string }) => Promise<string | undefined>;
type ListProductsService = (input: { tenantId: string }) => Promise<unknown[]>;

export async function composeServer(input: {
  readUptime: () => number;
  registry: ModuleRegistry;
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
  ];
  return mountRoutes({
    app: new Hono(),
    routes,
    answerRoute: answerWithRoute,
    resolveTenant: (host) => resolveTenantService({ host }),
  });
}
