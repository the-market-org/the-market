import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildEventBus,
  defineModule,
  findReadyNames,
  loadModules,
  orderModuleNames,
  resolveService,
} from "@the-market/core";
import type { ModuleContext } from "@the-market/core";

function buildTestContext(eventBus: ReturnType<typeof buildEventBus>) {
  return (input: { moduleName: string; schemaName: string }): ModuleContext => ({
    moduleName: input.moduleName,
    schemaName: input.schemaName,
    databaseUrl: "postgresql://unused",
    publishEvent: eventBus.publishEvent,
    subscribeEvent: eventBus.subscribeEvent,
  });
}

test("loads modules in dependency order and exposes their services", async () => {
  const eventBus = buildEventBus();
  const seenEvents: unknown[] = [];
  const catalogModule = defineModule({
    name: "catalog",
    version: "0.0.0",
    schemaName: "catalog",
    dependsOn: [],
    register: (context) => ({
      addProduct: (product: { productId: string }) =>
        context.publishEvent("catalog.product.created", { productId: product.productId }),
    }),
  });
  const searchModule = defineModule({
    name: "search",
    version: "0.0.0",
    schemaName: "search",
    dependsOn: ["catalog"],
    register: (context) => {
      context.subscribeEvent("catalog.product.created", (payload) => {
        seenEvents.push(payload);
      });
      return {};
    },
  });

  const registry = await loadModules({
    definitions: [searchModule, catalogModule],
    buildContext: buildTestContext(eventBus),
    orderNames: orderModuleNames,
    findReady: findReadyNames,
  });

  assert.deepEqual(Object.keys(registry), ["catalog", "search"]);
  const addProduct = resolveService({ registry, moduleName: "catalog", serviceName: "addProduct" }) as (
    product: object,
  ) => Promise<void>;
  await addProduct({ productId: "prod_1", title: "Lead", priceMinor: 1200, currencyCode: "GBP" });
  assert.deepEqual(seenEvents, [{ productId: "prod_1" }]);
});

test("rejects a dependency on a module that is not installed", async () => {
  const orphanModule = defineModule({
    name: "orphan",
    version: "0.0.0",
    schemaName: "orphan",
    dependsOn: ["missing"],
    register: () => ({}),
  });
  await assert.rejects(
    loadModules({
      definitions: [orphanModule],
      buildContext: buildTestContext(buildEventBus()),
      orderNames: orderModuleNames,
      findReady: findReadyNames,
    }),
    /Circular or missing module dependency among: orphan/,
  );
});
