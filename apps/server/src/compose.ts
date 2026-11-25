/**
 * Composition root of the server: wires the routes to the loaded modules.
 * It takes the module registry and capabilities as input, so tests can pass fakes.
 */
import { resolveService } from "@the-market/core";
import type { CapabilityRegistry, ModuleRegistry } from "@the-market/core";
import type { PaymentProvider } from "@the-market/payment";
import type { IdentitySocket } from "@the-market/sockets";
import { Hono } from "hono";
import { hasAgentRole, matchesAgent } from "./agent-access.ts";
import { handleListCapabilities } from "./capabilities-handler.ts";
import { composeChangeSetRoutes } from "./change-sets/compose-change-sets.ts";
import { handleHealth } from "./health-handler.ts";
import { answerWithRoute, mountRoutes } from "./hono-adapter.ts";
import { guardMerchantRoutes, isMerchantOf, matchesMerchant, matchesMerchantToken, readBearerToken } from "./merchant-token.ts";
import { composeAgentCardRoute } from "./a2a/compose-a2a.ts";
import { composeAppRoutes } from "./apps/compose-apps.ts";
import { composeExperimentRoutes } from "./experiments/compose-experiments.ts";
import { composePlatformRoutes, guardPlatformRoutes, matchesPlatformToken } from "./platform-access.ts";
import type { AppAccess } from "./apps/compose-apps.ts";
import { composeShopperRoutes } from "./checkout/compose-checkout.ts";
import { composeConnectionRoutes } from "./connections/compose-connections.ts";
import { composeAgentRoutes } from "./mcp/compose-mcp.ts";
import { handleListProducts } from "./products-handler.ts";
import { composeStorefrontRoutes } from "./storefront/compose-storefront.ts";
import type { Route } from "./hono-adapter.ts";

type ResolveTenantService = (input: { host: string }) => Promise<string | undefined>;
type ListProductsService = (input: { tenantId: string }) => Promise<unknown[]>;

export async function composeServer(input: {
  readUptime: () => number;
  registry: ModuleRegistry;
  capabilities: CapabilityRegistry;
  /** Shared merchant token for local development. Empty means it is not accepted. */
  merchantToken: string;
  identity: IdentitySocket;
  /** True when identity tokens can be verified (a secret is configured). */
  identityEnabled: boolean;
  /** Allow plain-http agent event URLs to this machine; never in production. */
  allowLocalHttp?: boolean;
  /** The payment gateway for checkout; the fake provider when absent. */
  paymentProvider?: PaymentProvider;
  /** Fetching, DNS and the app authoriser for installing apps; installs are refused when absent. */
  appAccess?: AppAccess;
  /** The token a publisher uses on /api/platform/ routes; without it those routes are not mounted. */
  platformToken?: string;
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
  const merchantEnabled = input.merchantToken !== "" || input.identityEnabled;
  const merchantRoutes = merchantEnabled
    ? [
        ...composeChangeSetRoutes({ registry: input.registry, capabilities: input.capabilities }),
        ...composeConnectionRoutes({ registry: input.registry, allowLocalHttp: input.allowLocalHttp === true }),
        ...composeAppRoutes({ registry: input.registry, allowLocalHttp: input.allowLocalHttp === true, access: input.appAccess }),
        ...composeExperimentRoutes({ registry: input.registry, capabilities: input.capabilities, readNow: Date.now }),
      ]
    : [];
  const matchesRequest = (request: { authorization: string; tenantId: string }) =>
    matchesMerchant({
      ...request,
      merchantToken: input.merchantToken,
      verifyToken: input.identity.verifyToken,
      matchesShared: matchesMerchantToken,
      readBearer: readBearerToken,
      isMerchant: isMerchantOf,
    });
  return mountRoutes({
    app: new Hono(),
    routes: [
      ...routes,
      ...composeStorefrontRoutes({ registry: input.registry, sendRequest: input.appAccess?.sendRequest }),
      composeAgentCardRoute({ registry: input.registry }),
      ...composeShopperRoutes({ registry: input.registry, paymentProvider: input.paymentProvider }),
      ...guardMerchantRoutes({ routes: merchantRoutes, enabled: merchantEnabled, matches: matchesRequest }),
      ...guardPlatformRoutes({ routes: composePlatformRoutes({ registry: input.registry }), platformToken: input.platformToken ?? "", matches: matchesPlatformToken }),
      ...composeAgentRoutes({
        enabled: input.identityEnabled,
        registry: input.registry,
        capabilities: input.capabilities,
        matches: (request) =>
          matchesAgent({ ...request, verifyToken: input.identity.verifyToken, readBearer: readBearerToken, hasRole: hasAgentRole }),
      }),
    ],
    answerRoute: answerWithRoute,
    resolveTenant: (host) => resolveTenantService({ host }),
  });
}
