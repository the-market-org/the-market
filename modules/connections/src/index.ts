import { defineModule } from "@the-market/core";
import type { ServiceMap } from "@the-market/core";

export type { ConnectionsDatabase, DeliveryTarget } from "./connections-types.ts";

/**
 * Composition root of the connections module. Its services arrive in a later task;
 * for now it only claims the "connections" PostgreSQL schema.
 */
export function registerConnections(): ServiceMap {
  return {};
}

export const connectionsModule = defineModule({
  name: "connections",
  version: "0.0.0",
  schemaName: "connections",
  dependsOn: [],
  register: registerConnections,
});
