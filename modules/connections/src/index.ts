import { defineModule } from "@the-market/core";
import { randomBytes } from "node:crypto";
import type { ModuleContext, ServiceMap } from "@the-market/core";
import { buildConnectionsServices, describeConnection } from "./connections-services.ts";
import { buildConnectionsDatabase } from "./prisma-connections-database.ts";

export type { ConnectionsDatabase, DeliveryTarget } from "./connections-types.ts";

/**
 * Composition root of the connections module: connects the services to the
 * module's own "connections" PostgreSQL schema and nothing else.
 */
export function registerConnections(context: ModuleContext): ServiceMap {
  return buildConnectionsServices({
    database: buildConnectionsDatabase({ databaseUrl: context.databaseUrl }),
    generateSecret: () => randomBytes(32).toString("hex"),
    describe: describeConnection,
  });
}

export const connectionsModule = defineModule({
  name: "connections",
  version: "0.0.0",
  schemaName: "connections",
  dependsOn: [],
  register: registerConnections,
});
