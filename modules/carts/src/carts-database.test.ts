/**
 * Runs only when DATABASE_URL is set (CI provides a PostgreSQL service).
 * Requires `pnpm db carts migrate deploy` to have run first.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildCartsDatabase } from "./prisma-carts-database.ts";

const databaseUrl = process.env.DATABASE_URL;

test("carts belong to one store, lines set and remove, and convert once", { skip: databaseUrl === undefined }, async () => {
  const moduleUrl = buildModuleDatabaseUrl({ databaseUrl: String(databaseUrl), schemaName: "carts" });
  const database = buildCartsDatabase({ databaseUrl: moduleUrl });
  const client = new PrismaClient({ datasourceUrl: moduleUrl });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const [leadId, toyId] = [randomUUID(), randomUUID()];
  try {
    const cart = await database.insertCart({ tenantId: tenantA });
    const keys = { tenantId: tenantA, cartId: cart.cartId };
    assert.deepEqual([cart.status, cart.lines], ["open", []]);

    await database.setLine({ ...keys, productId: leadId, quantity: 2 });
    await database.setLine({ ...keys, productId: toyId, quantity: 1 });
    await database.setLine({ ...keys, productId: leadId, quantity: 3 });
    await database.setLine({ ...keys, productId: toyId, quantity: 0 });
    assert.deepEqual((await database.findCart(keys))?.lines, [{ productId: leadId, quantity: 3 }]);

    assert.equal(await database.findCart({ tenantId: tenantB, cartId: cart.cartId }), undefined);
    assert.equal(await database.findCart({ tenantId: tenantA, cartId: "not-a-uuid" }), undefined);

    const convert = { ...keys, fromStatus: "open", toStatus: "converted" };
    assert.equal(await database.updateStatus({ ...convert, tenantId: tenantB }), 0);
    assert.equal(await database.updateStatus(convert), 1);
    assert.equal(await database.updateStatus(convert), 0);
  } finally {
    await client.cartLine.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await client.cart.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([client.$disconnect(), database.disconnect()]);
  }
});
