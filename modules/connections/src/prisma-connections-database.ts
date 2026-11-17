/**
 * The only file in this module that touches Prisma. It implements the
 * ConnectionsDatabase port and is the only place that turns a tenant id into a query filter.
 */
import type { ConnectionsDatabase } from "./connections-types.ts";
import { PrismaClient } from "./generated/client/index.js";

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
