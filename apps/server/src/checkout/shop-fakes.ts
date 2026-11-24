/** Test helper: an in-memory shop (two stores, one product, carts) shaped like the real module services. */
export const LEAD = "6f1c2a9e-3b4d-4c5e-8f70-1a2b3c4d5e6f";

export function buildShopRegistry() {
  const carts = new Map<string, { cartId: string; tenantId: string; status: string; lines: Array<{ productId: string; quantity: number }> }>();
  const findCart = async (keys: { tenantId: string; cartId: string }) => {
    const cart = carts.get(keys.cartId);
    return cart?.tenantId === keys.tenantId ? cart : undefined;
  };
  return {
    tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[request.host], findTenant: async () => ({ name: "Shop" }) },
    catalog: { listProducts: async () => [{ productId: LEAD, handle: "rope-lead", title: "Rope lead", status: "active", priceMinor: 1800, currencyCode: "GBP" }] },
    pages: { findPage: async () => undefined },
    carts: {
      createCart: async (request: { tenantId: string }) => {
        const cart = { cartId: `cart_${carts.size + 1}`, tenantId: request.tenantId, status: "open", lines: [] };
        carts.set(cart.cartId, cart);
        return cart;
      },
      findCart,
      setLine: async (line: { tenantId: string; cartId: string; productId: string; quantity: number }) => {
        const cart = await findCart(line);
        if (cart === undefined) {
          throw new Error("Cart not found");
        }
        cart.lines = [...cart.lines.filter((existing) => existing.productId !== line.productId), { productId: line.productId, quantity: line.quantity }];
        return cart;
      },
    },
  };
}
