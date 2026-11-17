import type { ServiceMap } from "@the-market/core";
import type { CartRecord, CartsDatabase } from "./carts-types.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A line must name a product by id and hold a whole quantity from 0 (remove) to 99. */
export function checkLine(input: { productId: string; quantity: number }): void {
  if (!(Number.isInteger(input.quantity) && input.quantity >= 0 && input.quantity <= 99)) {
    throw new Error("Invalid input: quantity must be a whole number from 0 to 99");
  }
  if (!UUID_PATTERN.test(input.productId)) {
    throw new Error("Invalid input: productId must be a product id");
  }
}

/** The tenant's open cart, or the reason there is none. */
export async function requireOpenCart(input: { tenantId: string; cartId: string; findCart: CartsDatabase["findCart"] }): Promise<CartRecord> {
  const cart = await input.findCart({ tenantId: input.tenantId, cartId: input.cartId });
  if (cart === undefined) {
    throw new Error("Cart not found");
  }
  if (cart.status !== "open") {
    throw new Error("Cart is already checked out");
  }
  return cart;
}

/** Builds the carts module's public services over a storage port. */
export function buildCartsServices(input: { database: CartsDatabase; check: typeof checkLine; requireOpen: typeof requireOpenCart }): ServiceMap {
  const { database } = input;
  return {
    createCart: (request: { tenantId: string }) => database.insertCart(request),
    findCart: (request: { tenantId: string; cartId: string }) => database.findCart(request),
    /** Sets one product's quantity in an open cart and returns the cart as it now is. */
    setLine: async (request: { tenantId: string; cartId: string; productId: string; quantity: number }) => {
      input.check(request);
      await input.requireOpen({ ...request, findCart: database.findCart });
      await database.setLine(request);
      return database.findCart(request);
    },
    /** Closes an open cart once its order is paid. */
    markConverted: async (request: { tenantId: string; cartId: string }) => {
      await input.requireOpen({ ...request, findCart: database.findCart });
      const changed = await database.updateStatus({ ...request, fromStatus: "open", toStatus: "converted" });
      return changed === 1 ? undefined : Promise.reject(new Error("Cart is already checked out"));
    },
  };
}
