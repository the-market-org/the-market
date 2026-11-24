import type { ServiceMap } from "@the-market/core";
import type { OrderLineRecord, OrderRecord, OrdersDatabase } from "./orders-types.ts";

type OrderKeys = { tenantId: string; orderId: string };

/** The message for a move that changed nothing: the order is missing, or not pending. */
export function explainRefusedOrderMove(order: OrderRecord | undefined): string {
  return order === undefined ? "Order not found" : "Order is not pending";
}

/** Moves a pending order to another state and returns it as it now is. */
export async function moveOrder(input: {
  keys: OrderKeys;
  toStatus: string;
  paymentProviderId: string;
  paymentReference: string;
  database: OrdersDatabase;
  explain: typeof explainRefusedOrderMove;
}): Promise<OrderRecord> {
  const changed = await input.database.updateStatus({ ...input.keys, fromStatus: "pending", toStatus: input.toStatus, paymentProviderId: input.paymentProviderId, paymentReference: input.paymentReference });
  const order = await input.database.findOrder(input.keys);
  if (changed === 0) {
    throw new Error(input.explain(order));
  }
  return order as OrderRecord;
}

/** Builds the orders module's public services over a storage port. */
export function buildOrdersServices(input: {
  database: OrdersDatabase;
  move: typeof moveOrder;
  explain: typeof explainRefusedOrderMove;
  publishEvent: (eventName: string, payload: unknown) => Promise<void>;
}): ServiceMap {
  const { database } = input;
  return {
    placeOrder: (request: { tenantId: string; currencyCode: string; totalMinor: number; lines: OrderLineRecord[] }) => database.insertOrder(request),
    findOrder: (request: OrderKeys) => database.findOrder(request),
    findOrderByNumber: (request: { tenantId: string; orderNumber: number }) => database.findOrderByNumber(request),
    /** Records the payment and tells the rest of the system: `orders.order.paid`. */
    markPaid: async (request: OrderKeys & { paymentProviderId: string; paymentReference: string }) => {
      const { paymentProviderId, paymentReference, ...keys } = request;
      const order = await input.move({ keys, toStatus: "paid", paymentProviderId, paymentReference, database, explain: input.explain });
      await input.publishEvent("orders.order.paid", { tenantId: order.tenantId, orderId: order.orderId, orderNumber: order.orderNumber, totalMinor: order.totalMinor });
      return order;
    },
    cancelOrder: (request: OrderKeys) => input.move({ keys: request, toStatus: "canceled", paymentProviderId: "", paymentReference: "", database, explain: input.explain }),
  };
}
