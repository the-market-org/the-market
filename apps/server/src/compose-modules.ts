/**
 * Loads every module against the database. To add a module, add its
 * definition to the list below.
 */
import {
  buildEventBus,
  buildModuleDatabaseUrl,
  findReadyNames,
  loadModules,
  orderModuleNames,
} from "@the-market/core";
import type { ModuleRegistry } from "@the-market/core";
import { catalogModule } from "@the-market/module-catalog";
import { tenancyModule } from "@the-market/module-tenancy";

export function composeModules(input: { databaseUrl: string }): Promise<ModuleRegistry> {
  const eventBus = buildEventBus();
  return loadModules({
    definitions: [tenancyModule, catalogModule],
    buildContext: (moduleInfo) => ({
      ...moduleInfo,
      databaseUrl: buildModuleDatabaseUrl({ databaseUrl: input.databaseUrl, schemaName: moduleInfo.schemaName }),
      publishEvent: eventBus.publishEvent,
      subscribeEvent: eventBus.subscribeEvent,
    }),
    orderNames: orderModuleNames,
    findReady: findReadyNames,
  });
}
