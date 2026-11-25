/** Composition of the storefront routes: the only place their concrete functions are wired. */
import { createHash } from "node:crypto";
import { buildSkillMessage, composeA2aClient } from "@the-market/a2a-gateway";
import { assignArm } from "@the-market/module-experiments";
import { resolveService } from "@the-market/core";
import type { ModuleRegistry, SendRequest } from "@the-market/core";
import { cleanFragment, DEFAULT_PAGES, DEFAULT_SECTIONS, escapeHtml, formatPrice, limitDuration, readSettingText, renderPage, scopeHtmxRequests, stripActiveContent, wrapDocument, wrapFragment } from "@the-market/theme-engine";
import type { Route } from "../hono-adapter.ts";
import { handleHomePage, handleProductPage, renderStorePage } from "./storefront-handlers.ts";
import type { StorefrontSteps } from "./storefront-handlers.ts";
import { loadSlotFragments, readFragmentText } from "./slot-fragments.ts";
import type { SlotSteps } from "./slot-fragments.ts";
import { readCookie } from "./cart-pages.ts";
import { recordKnownVisitor, recordQuietly, serveVisitorPage, VISITOR_COOKIE } from "./visitor-telemetry.ts";
import type { StoreEvent } from "./visitor-telemetry.ts";
import type { RouteRequest } from "../hono-adapter.ts";
import type { HttpReply } from "@the-market/core";
import { findPreviewSections } from "./preview-handler.ts";
import { chooseVariantSections } from "./variant-pages.ts";
import type { VariantSteps } from "./variant-pages.ts";

const SLOT_TIME_LIMIT_MS = 300;

/** Experiment steps over the loaded modules; a missing module rejects, and the visitor sees the live page. */
function buildVariantSteps(registry: ModuleRegistry): VariantSteps {
  const call = (moduleName: string, serviceName: string) => async (request: unknown) => (resolveService({ registry, moduleName, serviceName }) as (request: unknown) => Promise<never>)(request);
  const findChangeSet = call("changes", "findChangeSet") as (request: unknown) => Promise<{ items: Awaited<ReturnType<VariantSteps["findItems"]>> } | undefined>;
  return {
    findRunning: call("experiments", "findRunningExperiment"),
    assign: (request) => assignArm({ ...request, digest: (text) => createHash("sha256").update(text).digest() }),
    recordExposure: call("experiments", "recordExposure"),
    findItems: async (request) => (await findChangeSet(request))?.items ?? [],
    findSections: findPreviewSections,
  };
}

/** Events go to the experiments module when it is loaded; without it, or when it fails, nothing is recorded. */
export function buildEventRecorder(registry: ModuleRegistry): (event: StoreEvent) => void {
  const record = (event: StoreEvent) => (resolveService({ registry, moduleName: "experiments", serviceName: "recordEvent" }) as (event: StoreEvent) => Promise<void>)(event);
  return (event) => recordKnownVisitor({ event, record: (known) => recordQuietly({ record, event: known }) });
}

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
  const record = buildEventRecorder(input.registry);
  const variantSteps = buildVariantSteps(input.registry);
  const visit = (request: RouteRequest, pageKey: string, run: (pageSteps: StorefrontSteps) => Promise<HttpReply>) =>
    serveVisitorPage({
      tenantId: request.tenantId,
      pageKey,
      cookieValue: readCookie({ cookieHeader: String(request.headerValues.cookie ?? ""), cookieName: VISITOR_COOKIE }),
      createKey: () => crypto.randomUUID(),
      run: async (visitorKey) => {
        const sections = await chooseVariantSections({ tenantId: request.tenantId, pageKey, visitorKey, steps: variantSteps });
        return run(sections === undefined ? steps : { ...steps, findPage: async () => sections });
      },
      record,
    });
  return [
    { method: "GET", path: "/", tenantScoped: true, handleRequest: (request) => visit(request, "home", (pageSteps) => handleHomePage({ tenantId: request.tenantId, steps: pageSteps, renderPage: renderStorePage })) },
    {
      method: "GET",
      path: "/products/:handle",
      tenantScoped: true,
      handleRequest: (request) =>
        visit(request, "product", (pageSteps) => handleProductPage({ tenantId: request.tenantId, handle: String(request.pathParams.handle), steps: pageSteps, renderPage: renderStorePage })),
    },
  ];
}
