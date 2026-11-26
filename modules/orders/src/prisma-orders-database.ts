/**
 * The only file in this module that touches Prisma. It implements the
 * OrdersDatabase port and is the only place that turns a tenant id into a query filter.
 */
import type { OrderRecord, OrdersDatabase } from "./orders-types.ts";
import { runAsTenant } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import type { Prisma } from "./generated/client/index.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WITH_LINES = { lines: { orderBy: { titleSnapshot: "asc" } } } as const;

type StoredOrder = Omit<OrderRecord, "lines"> & { placedAt: Date; lines: Array<OrderRecord["lines"][number] & { lineId: string; tenantId: string; orderId: string }> };

export function describeOrder(stored: StoredOrder): OrderRecord {
  const { placedAt: _placedAt, lines, ...order } = stored;
  return { ...order, lines: lines.map((line) => ({ productId: line.productId, titleSnapshot: line.titleSnapshot, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor })) };
}

/** True when a unique constraint stopped the insert: two orders took the same number at once. */
export function isNumberClash(error: unknown): boolean {
  return (error as { code?: unknown }).code === "P2002";
}

export function buildOrdersDatabase(input: { databaseUrl: string }): OrdersDatabase & { disconnect: () => Promise<void> } {
  const client = new PrismaClient({ datasourceUrl: input.databaseUrl });
  const asTenant = <Result>(tenantId: string, work: (transaction: Prisma.TransactionClient) => Promise<Result>) => runAsTenant({ client, tenantId, work });
  const findFirst = async (where: { tenantId: string } & Record<string, unknown>) => asTenant(where.tenantId, async (transaction) => (await transaction.order.findMany({ where, include: WITH_LINES })).map(describeOrder)[0]);
  const insertOnce = (order: Parameters<OrdersDatabase["insertOrder"]>[0]) =>
    asTenant(order.tenantId, async (transaction) => {
      const highest = await transaction.order.aggregate({ where: { tenantId: order.tenantId }, _max: { orderNumber: true } });
      const lines = { create: order.lines.map((line) => ({ ...line, tenantId: order.tenantId })) };
      const data = { tenantId: order.tenantId, currencyCode: order.currencyCode, totalMinor: order.totalMinor, orderNumber: (highest._max.orderNumber ?? 0) + 1, lines };
      return describeOrder(await transaction.order.create({ data, include: WITH_LINES }));
    });
  return {
    insertOrder: (order) => insertOnce(order).catch((error: unknown) => (isNumberClash(error) ? insertOnce(order) : Promise.reject(error))),
    findOrder: async (query) => (UUID_PATTERN.test(query.orderId) ? findFirst({ tenantId: query.tenantId, orderId: query.orderId }) : undefined),
    findOrderByNumber: (query) => findFirst({ tenantId: query.tenantId, orderNumber: query.orderNumber }),
    updateStatus: async (move) => {
      const payment = Object.fromEntries(Object.entries({ paymentProviderId: move.paymentProviderId, paymentReference: move.paymentReference }).filter(([, value]) => value !== ""));
      const result = await asTenant(move.tenantId, (transaction) => transaction.order.updateMany({ where: { tenantId: move.tenantId, orderId: move.orderId, status: move.fromStatus }, data: { status: move.toStatus, ...payment } }));
      return result.count;
    },
    disconnect: () => client.$disconnect(),
  };
}
