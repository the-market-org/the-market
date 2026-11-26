/** Where a store's events go, with the secret that signs them. Server-internal: never sent to clients. */
export interface DeliveryTarget {
  eventsUrl: string;
  eventNames: string[];
  signingSecret: string;
}

/** What the services need from storage. The Prisma adapter implements it. */
export interface ConnectionsDatabase {
  /** Creates or replaces the store's one connection. */
  saveConnection: (input: { tenantId: string } & DeliveryTarget) => Promise<void>;
  findConnection: (input: { tenantId: string }) => Promise<DeliveryTarget | undefined>;
  removeConnection: (input: { tenantId: string }) => Promise<void>;
  insertMessage: (input: { tenantId: string; text: string }) => Promise<MerchantMessage>;
  /** The store's messages, newest first, at most `limit`. */
  listMessages: (input: { tenantId: string; limit: number }) => Promise<MerchantMessage[]>;
}

/** One message the merchant wrote to the store's agent. */
export interface MerchantMessage {
  messageId: string;
  text: string;
  sentAt: string;
}
