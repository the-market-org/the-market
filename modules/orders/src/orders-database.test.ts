/**
 * Runs only when DATABASE_URL is set (CI provides a PostgreSQL service).
 * Requires `pnpm db orders migrate deploy` to have run first.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildOrdersDatabase } from "./prisma-orders-database.ts";

const databaseUrl = process.env.DATABASE_URL;

test("order numbers count per store, even when two orders arrive together", { skip: databaseUrl === undefined }, async () => {
  const moduleUrl = buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "orders" });
  const database = buildOrdersDatabase({ databaseUrl: moduleUrl });
  const client = new PrismaClient({ datasourceUrl: moduleUrl });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const line = { productId: randomUUID(), titleSnapshot: "Rope lead", quantity: 2, unitPriceMinor: 1800 };
  const order = (tenantId: string) => database.insertOrder({ tenantId, currencyCode: "GBP", totalMinor: 3600, lines: [line] });
  try {
    const first = await order(tenantA);
    assert.deepEqual([first.orderNumber, first.status, first.lines], [1, "pending", [line]]);
    assert.equal((await order(tenantA)).orderNumber, 2);
    const together = await Promise.all([order(tenantB), order(tenantB)]);
    assert.deepEqual(together.map((placed) => placed.orderNumber).sort(), [1, 2]);

    assert.equal((await database.findOrderByNumber({ tenantId: tenantA, orderNumber: 1 }))?.orderId, first.orderId);
    assert.equal(await database.findOrder({ tenantId: tenantB, orderId: first.orderId }), undefined);
    assert.equal(await database.findOrder({ tenantId: tenantA, orderId: "not-a-uuid" }), undefined);

    const paid = { tenantId: tenantA, orderId: first.orderId, fromStatus: "pending", toStatus: "paid", paymentProviderId: "fake", paymentReference: "fake_1" };
    assert.equal(await database.updateStatus({ ...paid, tenantId: tenantB }), 0);
    assert.equal(await database.updateStatus(paid), 1);
    assert.equal(await database.updateStatus(paid), 0);
    const stored = await database.findOrder({ tenantId: tenantA, orderId: first.orderId });
    assert.deepEqual([stored?.status, stored?.paymentProviderId, stored?.paymentReference], ["paid", "fake", "fake_1"]);
  } finally {
    await client.orderLine.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await client.order.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([client.$disconnect(), database.disconnect()]);
  }
});
