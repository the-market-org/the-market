/**
 * The only file in this module that touches Prisma. It implements the
 * CartsDatabase port and is the only place that turns a tenant id into a query filter.
 */
import type { CartRecord, CartsDatabase } from "./carts-types.ts";
import { PrismaClient } from "./generated/client/index.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINES_IN_ORDER = { lines: { orderBy: { productId: "asc" } } } as const;

type StoredCart = { cartId: string; tenantId: string; status: string; lines: Array<{ productId: string; quantity: number }> };

export function describeCart(stored: StoredCart): CartRecord {
  return { cartId: stored.cartId, tenantId: stored.tenantId, status: stored.status, lines: stored.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })) };
}

export function buildCartsDatabase(input: { databaseUrl: string }): CartsDatabase & { disconnect: () => Promise<void> } {
  const client = new PrismaClient({ datasourceUrl: input.databaseUrl });
  return {
    insertCart: async (cart) => describeCart(await client.cart.create({ data: { tenantId: cart.tenantId }, include: LINES_IN_ORDER })),
    findCart: async (query) => {
      const carts = UUID_PATTERN.test(query.cartId)
        ? await client.cart.findMany({ where: { tenantId: query.tenantId, cartId: query.cartId }, include: LINES_IN_ORDER })
        : [];
      return carts.map(describeCart)[0];
    },
    setLine: async (line) => {
      const where = { cartId_productId: { cartId: line.cartId, productId: line.productId } };
      await (line.quantity === 0
        ? client.cartLine.deleteMany({ where: { tenantId: line.tenantId, cartId: line.cartId, productId: line.productId } })
        : client.cartLine.upsert({ where, create: { tenantId: line.tenantId, cartId: line.cartId, productId: line.productId, quantity: line.quantity }, update: { quantity: line.quantity } }));
    },
    updateStatus: async (move) => {
      const result = await client.cart.updateMany({ where: { tenantId: move.tenantId, cartId: move.cartId, status: move.fromStatus }, data: { status: move.toStatus } });
      return result.count;
    },
    disconnect: () => client.$disconnect(),
  };
}
