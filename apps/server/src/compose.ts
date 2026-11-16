/**
 * Composition root of the server: loads the modules and wires the routes.
 * To add a module, add its definition to the list below.
 */
import {
  buildEventBus,
  buildModuleDatabaseUrl,
  findReadyNames,
  loadModules,
  orderModuleNames,
} from "@the-market/core";
import { catalogModule } from "@the-market/module-catalog";
import { Hono } from "hono";
import { handleHealth } from "./health-handler.ts";
import { answerWithRoute, mountRoutes } from "./hono-adapter.ts";
import type { Route } from "./hono-adapter.ts";

export async function composeServer(input: { readUptime: () => number; databaseUrl: string }): Promise<Hono> {
  const eventBus = buildEventBus();
  const registry = await loadModules({
    definitions: [catalogModule],
    buildContext: (moduleInfo) => ({
      ...moduleInfo,
      databaseUrl: buildModuleDatabaseUrl({ databaseUrl: input.databaseUrl, schemaName: moduleInfo.schemaName }),
      publishEvent: eventBus.publishEvent,
      subscribeEvent: eventBus.subscribeEvent,
    }),
    orderNames: orderModuleNames,
    findReady: findReadyNames,
  });
  const routes: Route[] = [
    {
      method: "GET",
      path: "/health",
      handleRequest: () => handleHealth({ moduleNames: Object.keys(registry), readUptime: input.readUptime }),
    },
  ];
  return mountRoutes({ app: new Hono(), routes, answerRoute: answerWithRoute });
}
