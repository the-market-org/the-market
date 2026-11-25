/** Composition of the storefront routes: the only place their concrete functions are wired. */
import { buildSkillMessage, composeA2aClient } from "@the-market/a2a-gateway";
import { resolveService } from "@the-market/core";
import type { ModuleRegistry, SendRequest } from "@the-market/core";
import { cleanFragment, DEFAULT_PAGES, DEFAULT_SECTIONS, escapeHtml, formatPrice, limitDuration, readSettingText, renderPage, scopeHtmxRequests, stripActiveContent, wrapDocument, wrapFragment } from "@the-market/theme-engine";
import type { Route } from "../hono-adapter.ts";
import { handleHomePage, handleProductPage, renderStorePage } from "./storefront-handlers.ts";
import type { StorefrontSteps } from "./storefront-handlers.ts";
import { loadSlotFragments, readFragmentText } from "./slot-fragments.ts";
import type { SlotSteps } from "./slot-fragments.ts";

const SLOT_TIME_LIMIT_MS = 300;

/** The slot steps over the apps module and an A2A client; with no sender, pages get no slots. */
function buildSlotSteps(input: { registry: ModuleRegistry; sendRequest: SendRequest }): SlotSteps {
  const client = composeA2aClient(input.sendRequest);
  return {
    listBindings: resolveService({ registry: input.registry, moduleName: "apps", serviceName: "listBindings" }) as SlotSteps["listBindings"],
    askApp: async (request) => {
      const params = { ...buildSkillMessage({ messageId: crypto.randomUUID(), skillId: request.skillId, skillInput: { slotName: request.slotName, ...request.pageValues } }), configuration: { returnImmediately: false } };
      return readFragmentText(await client.callMethod({ endpointUrl: request.rpcUrl, method: "SendMessage", params, requestId: crypto.randomUUID(), authToken: "" }));
    },
    clean: (request) => cleanFragment({ ...request, stripContent: stripActiveContent, scopeRequests: scopeHtmxRequests }),
    wrap: wrapFragment,
    limit: (work) => limitDuration({ work, timeoutMs: SLOT_TIME_LIMIT_MS, startTimer: setTimeout }),
  };
}

/** The storefront's reading and rendering steps over the loaded modules. */
export function buildStorefrontSteps(input: { registry: ModuleRegistry; sendRequest?: SendRequest }): StorefrontSteps {
  const service = (moduleName: string, serviceName: string) => resolveService({ registry: input.registry, moduleName, serviceName });
  const findTenant = service("tenancy", "findTenant") as (request: { tenantId: string }) => Promise<{ name: string } | undefined>;
  const steps: StorefrontSteps = {
    findStoreName: async (request) => (await findTenant(request))?.name ?? "",
    listProducts: service("catalog", "listProducts") as StorefrontSteps["listProducts"],
    findPage: service("pages", "findPage") as StorefrontSteps["findPage"],
    defaultPages: DEFAULT_PAGES,
    toCard: (product) => ({ productId: product.productId, handle: product.handle, title: product.title, priceText: formatPrice(product) }),
    render: (request) => renderPage({ ...request, definitions: DEFAULT_SECTIONS, escape: escapeHtml, readText: readSettingText, wrap: wrapDocument }),
    loadSlots: async () => ({}),
  };
  const sendRequest = input.sendRequest;
  if (sendRequest !== undefined) {
    steps.loadSlots = (request) => loadSlotFragments({ ...request, steps: buildSlotSteps({ registry: input.registry, sendRequest }) });
  }
  return steps;
}

export function composeStorefrontRoutes(input: { registry: ModuleRegistry; sendRequest?: SendRequest }): Route[] {
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
