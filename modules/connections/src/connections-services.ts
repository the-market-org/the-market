import type { ServiceMap } from "@the-market/core";
import type { ConnectionsDatabase, DeliveryTarget } from "./connections-types.ts";

/** A connection as merchants and agents may see it: never the signing secret. */
export function describeConnection(target: DeliveryTarget | undefined): { eventsUrl: string; eventNames: string[] } | undefined {
  return target === undefined ? undefined : { eventsUrl: target.eventsUrl, eventNames: [...target.eventNames] };
}

const MESSAGE_LIMIT = 2000;

/** The message's text without surrounding space, or a refusal when it is empty or longer than 2000 characters. */
export function checkMessageText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MESSAGE_LIMIT) {
    throw new Error(`Invalid input: a message is 1 to ${MESSAGE_LIMIT} characters`);
  }
  return trimmed;
}

/** Builds the connections module's public services over a storage port. */
export function buildConnectionsServices(input: {
  database: ConnectionsDatabase;
  generateSecret: () => string;
  describe: typeof describeConnection;
  checkText: typeof checkMessageText;
  publishEvent: (eventName: string, payload: unknown) => Promise<void>;
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
    /** Saves the merchant's message and tells the store's agent: `merchant.message.sent`. */
    sendMessage: async (request: { tenantId: string; text: string }) => {
      const message = await input.database.insertMessage({ tenantId: request.tenantId, text: input.checkText(request.text) });
      await input.publishEvent("merchant.message.sent", { tenantId: request.tenantId, messageId: message.messageId, text: message.text });
      return message;
    },
    listMessages: (request: { tenantId: string; limit?: number }) => input.database.listMessages({ tenantId: request.tenantId, limit: Math.min(Math.max(1, request.limit ?? 20), 100) }),
    /** For the server's event delivery only: includes the secret. */
    findDeliveryTarget: (request: { tenantId: string }) => input.database.findConnection(request),
  };
}
