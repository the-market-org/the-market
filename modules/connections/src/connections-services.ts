import type { ServiceMap } from "@the-market/core";
import type { ConnectionsDatabase, DeliveryTarget } from "./connections-types.ts";

/** A connection as merchants and agents may see it: never the signing secret. */
export function describeConnection(target: DeliveryTarget | undefined): { eventsUrl: string; eventNames: string[] } | undefined {
  return target === undefined ? undefined : { eventsUrl: target.eventsUrl, eventNames: [...target.eventNames] };
}

/** Builds the connections module's public services over a storage port. */
export function buildConnectionsServices(input: {
  database: ConnectionsDatabase;
  generateSecret: () => string;
  describe: typeof describeConnection;
}): ServiceMap {
  return {
    /** Saves the store's connection with a fresh signing secret, returned only here. */
    saveConnection: async (request: { tenantId: string; eventsUrl: string; eventNames: string[] }) => {
      const signingSecret = input.generateSecret();
      await input.database.saveConnection({ ...request, signingSecret });
      return { signingSecret };
    },
    findConnection: async (request: { tenantId: string }) => input.describe(await input.database.findConnection(request)),
    removeConnection: (request: { tenantId: string }) => input.database.removeConnection(request),
    /** For the server's event delivery only: includes the secret. */
    findDeliveryTarget: (request: { tenantId: string }) => input.database.findConnection(request),
  };
}
