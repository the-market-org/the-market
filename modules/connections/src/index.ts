import { defineModule } from "@the-market/core";
import { randomBytes } from "node:crypto";
import type { ModuleContext, ServiceMap } from "@the-market/core";
import { buildConnectionsServices, describeConnection } from "./connections-services.ts";
import { buildConnectionsDatabase, buildSealedDatabase } from "./prisma-connections-database.ts";
import { openSecret, readSecretsKey, readStoredSecret, sealSecret } from "./secret-box.ts";

export type { ConnectionsDatabase, DeliveryTarget } from "./connections-types.ts";

/**
 * Composition root of the connections module: connects the services to the
 * module's own "connections" PostgreSQL schema and nothing else.
 */
export function registerConnections(context: ModuleContext): ServiceMap {
  const setting = context.readSetting("SECRETS_KEY");
  if (setting === "" && context.readSetting("NODE_ENV") === "production") {
    throw new Error("SECRETS_KEY is not set; it is required in production to protect signing secrets");
  }
  const key = setting === "" ? undefined : readSecretsKey(setting);
  const database = buildSealedDatabase({
    database: buildConnectionsDatabase({ databaseUrl: context.databaseUrl }),
    seal: (plain) => (key === undefined ? plain : sealSecret({ plain, key })),
    read: (stored) => readStoredSecret({ stored, key, open: openSecret }),
  });
  return buildConnectionsServices({
    database,
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
