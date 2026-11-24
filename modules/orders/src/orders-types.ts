export interface OrderLineRecord {
  productId: string;
  titleSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface OrderRecord {
  orderId: string;
  tenantId: string;
  orderNumber: number;
  status: string;
  currencyCode: string;
  totalMinor: number;
  paymentProviderId: string;
  paymentReference: string;
  lines: OrderLineRecord[];
}

/** What the services need from storage. The Prisma adapter implements it. */
export interface OrdersDatabase {
  /** Stores a pending order with the tenant's next order number. */
  insertOrder: (input: { tenantId: string; currencyCode: string; totalMinor: number; lines: OrderLineRecord[] }) => Promise<OrderRecord>;
  findOrder: (input: { tenantId: string; orderId: string }) => Promise<OrderRecord | undefined>;
  findOrderByNumber: (input: { tenantId: string; orderNumber: number }) => Promise<OrderRecord | undefined>;
  /** Changes the status only from the stated one; empty payment fields leave the stored ones. Returns rows changed. */
  updateStatus: (input: { tenantId: string; orderId: string; fromStatus: string; toStatus: string; paymentProviderId: string; paymentReference: string }) => Promise<number>;
}
