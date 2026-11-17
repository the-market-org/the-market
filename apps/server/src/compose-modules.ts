/**
 * Loads every module against the database and collects their capabilities.
 * To add a module, add its definition to the list below.
 */
import {
  addCapability,
  buildEventBus,
  buildModuleDatabaseUrl,
  collectCapabilities,
  findReadyNames,
  listDeclaredCapabilities,
  loadModules,
  orderModuleNames,
} from "@the-market/core";
import type { CapabilityRegistry, EventBus, ModuleRegistry } from "@the-market/core";
import { cartsModule } from "@the-market/module-carts";
import { catalogModule } from "@the-market/module-catalog";
import { changesModule } from "@the-market/module-changes";
import { connectionsModule } from "@the-market/module-connections";
import { pagesModule } from "@the-market/module-pages";
import { tenancyModule } from "@the-market/module-tenancy";

export async function composeModules(input: {
  databaseUrl: string;
}): Promise<{ registry: ModuleRegistry; capabilities: CapabilityRegistry; subscribeEvent: EventBus["subscribeEvent"] }> {
  const definitions = [tenancyModule, catalogModule, changesModule, pagesModule, connectionsModule, cartsModule];
  const eventBus = buildEventBus();
  const registry = await loadModules({
    definitions,
    buildContext: (moduleInfo) => ({
      ...moduleInfo,
      databaseUrl: buildModuleDatabaseUrl({ databaseUrl: input.databaseUrl, schemaName: moduleInfo.schemaName }),
      publishEvent: eventBus.publishEvent,
      subscribeEvent: eventBus.subscribeEvent,
    }),
    orderNames: orderModuleNames,
    findReady: findReadyNames,
  });
  const capabilities = collectCapabilities({
    definitions,
    registry,
    listDeclared: listDeclaredCapabilities,
    addOne: addCapability,
  });
  return { registry, capabilities, subscribeEvent: eventBus.subscribeEvent };
}
