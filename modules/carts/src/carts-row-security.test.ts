/**
 * Runs only when DATABASE_URL (the owner) and CARTS_DATABASE_URL (the module's own role, from
 * `.env.module-roles`) are set. The policies bind the module's role, not the owner.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "./generated/client/index.js";
import { buildCartsDatabase } from "./prisma-carts-database.ts";

const ownerUrl = process.env.DATABASE_URL;
const roleUrl = process.env.CARTS_DATABASE_URL;

test("as the carts role, a cart and its lines belong to their tenant, and a query that names none sees nothing", { skip: ownerUrl === undefined || roleUrl === undefined }, async () => {
  const asRole = buildModuleDatabaseUrl({ databaseUrl: String(roleUrl), schemaName: "carts" });
  const database = buildCartsDatabase({ databaseUrl: asRole });
  const unscoped = new PrismaClient({ datasourceUrl: asRole });
  const owner = new PrismaClient({ datasourceUrl: buildModuleDatabaseUrl({ databaseUrl: String(ownerUrl), schemaName: "carts" }) });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const productId = randomUUID();
  try {
    const cart = await database.insertCart({ tenantId: tenantA });
    await database.setLine({ tenantId: tenantA, cartId: cart.cartId, productId, quantity: 2 });
    await database.setLine({ tenantId: tenantA, cartId: cart.cartId, productId, quantity: 3 });
    assert.deepEqual((await database.findCart({ tenantId: tenantA, cartId: cart.cartId }))?.lines.map((line) => line.quantity), [3], "the upsert keyed without the tenant still finds the tenant's line");
    assert.equal(await database.findCart({ tenantId: tenantB, cartId: cart.cartId }), undefined);
    assert.deepEqual(await unscoped.cartLine.findMany({ where: { cartId: cart.cartId } }), [], "a query that forgets its tenant sees no lines");
    assert.equal(await owner.cartLine.count({ where: { tenantId: tenantA } }), 1);
  } finally {
    await owner.cartLine.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await owner.cart.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
    await Promise.all([database.disconnect(), unscoped.$disconnect(), owner.$disconnect()]);
  }
});
