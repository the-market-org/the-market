import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCartsServices, checkLine, requireOpenCart } from "./carts-services.ts";
import type { CartRecord, CartsDatabase } from "./carts-types.ts";

const LEAD = "6f1c2a9e-3b4d-4c5e-8f70-1a2b3c4d5e6f";

function buildFakeDatabase(): CartsDatabase {
  const carts: CartRecord[] = [];
  const find = (keys: { tenantId: string; cartId: string }) => carts.find((cart) => cart.tenantId === keys.tenantId && cart.cartId === keys.cartId);
  return {
    insertCart: async (request) => {
      const cart = { cartId: `cart_${carts.length + 1}`, tenantId: request.tenantId, status: "open", lines: [] };
      carts.push(cart);
      return cart;
    },
    findCart: async (keys) => find(keys),
    setLine: async (line) => {
      const cart = find(line) as CartRecord;
      cart.lines = [...cart.lines.filter((existing) => existing.productId !== line.productId), ...(line.quantity === 0 ? [] : [{ productId: line.productId, quantity: line.quantity }])];
    },
    updateStatus: async (move) => {
      const cart = find(move);
      const matches = cart?.status === move.fromStatus;
      Object.assign(matches ? (cart as CartRecord) : {}, { status: move.toStatus });
      return matches ? 1 : 0;
    },
  };
}

type Services = Record<string, (input: Record<string, unknown>) => Promise<any>>;

function buildServices(): Services {
  return buildCartsServices({ database: buildFakeDatabase(), check: checkLine, requireOpen: requireOpenCart }) as unknown as Services;
}

test("a cart gets lines, a new quantity replaces the old, and 0 removes the line", async () => {
  const services = buildServices();
  const { cartId } = await services.createCart?.({ tenantId: "tenant-a" });
  await services.setLine?.({ tenantId: "tenant-a", cartId, productId: LEAD, quantity: 2 });
  const updated = await services.setLine?.({ tenantId: "tenant-a", cartId, productId: LEAD, quantity: 3 });
  assert.deepEqual(updated.lines, [{ productId: LEAD, quantity: 3 }]);
  assert.deepEqual((await services.setLine?.({ tenantId: "tenant-a", cartId, productId: LEAD, quantity: 0 })).lines, []);
});

test("quantities are whole numbers from 0 to 99, and product ids are ids", async () => {
  const services = buildServices();
  const { cartId } = await services.createCart?.({ tenantId: "tenant-a" });
  for (const quantity of [-1, 100, 1.5]) {
    await assert.rejects(services.setLine?.({ tenantId: "tenant-a", cartId, productId: LEAD, quantity }) as Promise<unknown>, { message: "Invalid input: quantity must be a whole number from 0 to 99" });
  }
  await assert.rejects(services.setLine?.({ tenantId: "tenant-a", cartId, productId: "lead", quantity: 1 }) as Promise<unknown>, { message: "Invalid input: productId must be a product id" });
});

test("another store's cart is not found, and a converted cart takes no lines and converts once", async () => {
  const services = buildServices();
  const { cartId } = await services.createCart?.({ tenantId: "tenant-a" });
  await assert.rejects(services.setLine?.({ tenantId: "tenant-b", cartId, productId: LEAD, quantity: 1 }) as Promise<unknown>, { message: "Cart not found" });
  await assert.rejects(services.markConverted?.({ tenantId: "tenant-b", cartId }) as Promise<unknown>, { message: "Cart not found" });

  await services.markConverted?.({ tenantId: "tenant-a", cartId });
  await assert.rejects(services.markConverted?.({ tenantId: "tenant-a", cartId }) as Promise<unknown>, { message: "Cart is already checked out" });
  await assert.rejects(services.setLine?.({ tenantId: "tenant-a", cartId, productId: LEAD, quantity: 1 }) as Promise<unknown>, { message: "Cart is already checked out" });
});
