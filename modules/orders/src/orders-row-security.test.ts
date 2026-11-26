/**
 * Runs only when DATABASE_URL (the owner) and ORDERS_DATABASE_URL (the module's own role, from
 * `.env.module-roles`) are set. The policies bind the module's role, not the owner.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildOrdersDatabase } from "./prisma-orders-database.ts";

const ownerUrl = process.env.DATABASE_URL;
const roleUrl = process.env.ORDERS_DATABASE_URL;

test("as the orders role, each store numbers its own orders, and a query that names no store sees none", { skip: ownerUrl === undefined || roleUrl === undefined }, async () => {
  const asRole = buildModuleDatabaseUrl({ databaseUrl: String(roleUrl), schemaName: "orders" });
  const database = buildOrdersDatabase({ databaseUrl: asRole });
  const unscoped = new PrismaClient({ datasourceUrl: asRole });
  const owner = new PrismaClient({ datasourceUrl: buildModuleDatabaseUrl({ databaseUrl: String(ownerUrl), schemaName: "orders" }) });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const order = (tenantId: string) => ({ tenantId, currencyCode: "GBP", totalMinor: 1800, lines: [{ productId: randomUUID(), titleSnapshot: "Lead", quantity: 1, unitPriceMinor: 1800 }] });
  try {
    const firstA = await database.insertOrder(order(tenantA));
    const secondA = await database.insertOrder(order(tenantA));
    const firstB = await database.insertOrder(order(tenantB));
    assert.deepEqual([firstA.orderNumber, secondA.orderNumber, firstB.orderNumber], [1, 2, 1], "the number counts the store's own orders only");
    assert.equal(await database.findOrder({ tenantId: tenantB, orderId: firstA.orderId }), undefined);
    assert.equal(await database.updateStatus({ tenantId: tenantB, orderId: firstA.orderId, fromStatus: "pending", toStatus: "paid", paymentProviderId: "", paymentReference: "" }), 0);
    assert.deepEqual(await unscoped.order.findMany({ where: { orderId: firstA.orderId } }), []);
    assert.equal(await owner.order.count({ where: { tenantId: { in: [tenantA, tenantB] } } }), 3);
  } finally {
    await owner.orderLine.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await owner.order.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([database.disconnect(), unscoped.$disconnect(), owner.$disconnect()]);
  }
});
