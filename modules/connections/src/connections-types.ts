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
}
