/**
 * The only file in this module that touches Prisma. It implements the
 * ConnectionsDatabase port and is the only place that turns a tenant id into a query filter.
 */
import type { ConnectionsDatabase } from "./connections-types.ts";
import { PrismaClient } from "./generated/client/index.js";

/** The same port, with signing secrets sealed on the way in and read back on the way out. */
export function buildSealedDatabase<Database extends ConnectionsDatabase>(input: { database: Database; seal: (plain: string) => string; read: (stored: string) => string }): Database {
  return {
    ...input.database,
    saveConnection: (connection) => input.database.saveConnection({ ...connection, signingSecret: input.seal(connection.signingSecret) }),
    findConnection: async (query) => {
      const found = await input.database.findConnection(query);
      return found === undefined ? undefined : { ...found, signingSecret: input.read(found.signingSecret) };
    },
  };
}

export function buildConnectionsDatabase(input: { databaseUrl: string }): ConnectionsDatabase & { disconnect: () => Promise<void> } {
  const client = new PrismaClient({ datasourceUrl: input.databaseUrl });
  return {
    saveConnection: async (connection) => {
      const target = { eventsUrl: connection.eventsUrl, eventNames: connection.eventNames, signingSecret: connection.signingSecret };
      await client.agentConnection.upsert({ where: { tenantId: connection.tenantId }, create: { tenantId: connection.tenantId, ...target }, update: target });
    },
    findConnection: async (query) => {
      const records = await client.agentConnection.findMany({ where: { tenantId: query.tenantId } });
      return records.map((record) => ({ eventsUrl: record.eventsUrl, eventNames: record.eventNames, signingSecret: record.signingSecret }))[0];
    },
    removeConnection: async (query) => {
      await client.agentConnection.deleteMany({ where: { tenantId: query.tenantId } });
    },
    disconnect: () => client.$disconnect(),
  };
}
