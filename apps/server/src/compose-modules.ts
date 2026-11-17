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
import type { CapabilityRegistry, ModuleRegistry } from "@the-market/core";
import { catalogModule } from "@the-market/module-catalog";
import { tenancyModule } from "@the-market/module-tenancy";

export async function composeModules(input: {
  databaseUrl: string;
}): Promise<{ registry: ModuleRegistry; capabilities: CapabilityRegistry }> {
  const definitions = [tenancyModule, catalogModule];
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
  return { registry, capabilities };
}
