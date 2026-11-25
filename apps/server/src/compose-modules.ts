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
import type { CapabilityRegistry, EventBus, ModuleRegistry, ServiceMap } from "@the-market/core";
import { appsModule } from "@the-market/module-apps";
import { cartsModule } from "@the-market/module-carts";
import { catalogModule } from "@the-market/module-catalog";
import { changesModule } from "@the-market/module-changes";
import { connectionsModule } from "@the-market/module-connections";
import { buildStartExperimentCapability, experimentsModule } from "@the-market/module-experiments";
import { ordersModule } from "@the-market/module-orders";
import { pagesModule } from "@the-market/module-pages";
import { tenancyModule } from "@the-market/module-tenancy";

type StartSteps = Parameters<typeof buildStartExperimentCapability>[0];

export async function composeModules(input: {
  databaseUrl: string;
}): Promise<{ registry: ModuleRegistry; capabilities: CapabilityRegistry; subscribeEvent: EventBus["subscribeEvent"] }> {
  const definitions = [tenancyModule, catalogModule, changesModule, pagesModule, connectionsModule, cartsModule, ordersModule, appsModule, experimentsModule];
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
  // experiments.start reads the changes module's change sets, so it is built here, where both modules are loaded.
  const experiments = registry.experiments as ServiceMap;
  const startCapability = buildStartExperimentCapability({
    findChangeSet: (registry.changes as ServiceMap).findChangeSet as StartSteps["findChangeSet"],
    findRunningExperiment: experiments.findRunningExperiment as StartSteps["findRunningExperiment"],
    startExperiment: experiments.startExperiment as StartSteps["startExperiment"],
    stopExperiment: experiments.stopExperiment as StartSteps["stopExperiment"],
    readNow: Date.now,
  });
  const allCapabilities = addCapability({ collected: capabilities, moduleName: "experiments", capability: startCapability });
  return { registry, capabilities: allCapabilities, subscribeEvent: eventBus.subscribeEvent };
}
