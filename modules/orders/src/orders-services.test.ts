import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOrdersServices, explainRefusedOrderMove, moveOrder } from "./orders-services.ts";
import type { OrderRecord, OrdersDatabase } from "./orders-types.ts";

function buildFakeDatabase(): OrdersDatabase {
  const orders: OrderRecord[] = [];
  const find = (keys: { tenantId: string; orderId: string }) => orders.find((order) => order.tenantId === keys.tenantId && order.orderId === keys.orderId);
  return {
    insertOrder: async (order) => {
      const record = { ...order, orderId: `order_${orders.length + 1}`, orderNumber: orders.filter((stored) => stored.tenantId === order.tenantId).length + 1, status: "pending", paymentProviderId: "", paymentReference: "" };
      orders.push(record);
      return record;
    },
    findOrder: async (keys) => find(keys),
    findOrderByNumber: async (query) => orders.find((order) => order.tenantId === query.tenantId && order.orderNumber === query.orderNumber),
    updateStatus: async (move) => {
      const order = find(move);
      const matches = order?.status === move.fromStatus;
      Object.assign(matches ? (order as OrderRecord) : {}, { status: move.toStatus, paymentProviderId: move.paymentProviderId || order?.paymentProviderId, paymentReference: move.paymentReference || order?.paymentReference });
      return matches ? 1 : 0;
    },
  };
}

type Services = Record<string, (input: Record<string, unknown>) => Promise<any>>;

function buildServices(published: Array<[string, unknown]>): Services {
  return buildOrdersServices({
    database: buildFakeDatabase(),
    move: moveOrder,
    explain: explainRefusedOrderMove,
    publishEvent: async (eventName, payload) => void published.push([eventName, payload]),
  }) as unknown as Services;
}

const newOrder = { tenantId: "tenant-a", currencyCode: "GBP", totalMinor: 3600, lines: [{ productId: "p1", titleSnapshot: "Rope lead", quantity: 2, unitPriceMinor: 1800 }] };

test("a placed order is pending; paying it records the payment and tells the system", async () => {
  const published: Array<[string, unknown]> = [];
  const services = buildServices(published);
  const placed = await services.placeOrder?.(newOrder);
  assert.deepEqual([placed.orderNumber, placed.status, published], [1, "pending", []]);

  const paid = await services.markPaid?.({ tenantId: "tenant-a", orderId: placed.orderId, paymentProviderId: "fake", paymentReference: "fake_order_1" });
  assert.deepEqual([paid.status, paid.paymentReference], ["paid", "fake_order_1"]);
  assert.deepEqual(published, [["orders.order.paid", { tenantId: "tenant-a", orderId: placed.orderId, orderNumber: 1, totalMinor: 3600 }]]);
  assert.equal((await services.findOrderByNumber?.({ tenantId: "tenant-a", orderNumber: 1 })).orderId, placed.orderId);
});

test("only a pending order can be paid or cancelled, and another store's order is not found", async () => {
  const services = buildServices([]);
  const placed = await services.placeOrder?.(newOrder);
  await assert.rejects(services.markPaid?.({ tenantId: "tenant-b", orderId: placed.orderId, paymentProviderId: "fake", paymentReference: "r" }) as Promise<unknown>, { message: "Order not found" });

  await services.cancelOrder?.({ tenantId: "tenant-a", orderId: placed.orderId });
  await assert.rejects(services.markPaid?.({ tenantId: "tenant-a", orderId: placed.orderId, paymentProviderId: "fake", paymentReference: "r" }) as Promise<unknown>, { message: "Order is not pending" });
  await assert.rejects(services.cancelOrder?.({ tenantId: "tenant-a", orderId: placed.orderId }) as Promise<unknown>, { message: "Order is not pending" });
});
