/** Shopper cart routes. Public and tenant-scoped: the random cart id is the shopper's key. */
import type { HttpReply } from "@the-market/core";
import type { RouteHelpers } from "../change-sets/change-set-routes.ts";
import type { Route, RouteRequest } from "../hono-adapter.ts";
import type { CatalogProduct, PricedCart } from "./price-cart.ts";

type CartLine = { productId: string; quantity: number };
type Cart = { cartId: string; status: string; lines: CartLine[] };

export interface CartActions {
  createCart: (input: { tenantId: string }) => Promise<Cart>;
  findCart: (input: { tenantId: string; cartId: string }) => Promise<Cart | undefined>;
  setLine: (input: { tenantId: string; cartId: string; productId: string; quantity: number }) => Promise<Cart | undefined>;
  listProducts: (input: { tenantId: string }) => Promise<CatalogProduct[]>;
  priceLines: (input: { lines: CartLine[]; products: CatalogProduct[] }) => PricedCart;
}

const LINE_SCHEMA = { type: "object", required: ["quantity"], properties: { quantity: { type: "number" } } };

/** The cart as the shopper sees it: priced from the catalog; an empty cart totals 0. */
export async function describeCart(input: { tenantId: string; cart: Cart | undefined; actions: CartActions }): Promise<Record<string, unknown>> {
  if (input.cart === undefined) {
    throw new Error("Cart not found");
  }
  const priced = input.cart.lines.length === 0
    ? { currencyCode: "", totalMinor: 0, lines: [] }
    : input.actions.priceLines({ lines: input.cart.lines, products: await input.actions.listProducts({ tenantId: input.tenantId }) });
  return { cartId: input.cart.cartId, status: input.cart.status, ...priced };
}

export function buildCartRoutes(input: { actions: CartActions; helpers: RouteHelpers; describe: typeof describeCart }): Route[] {
  const { actions, helpers } = input;
  const route = (method: Route["method"], path: string, handle: (request: RouteRequest) => Promise<HttpReply>): Route => ({
    method,
    path,
    tenantScoped: true,
    handleRequest: (request) => helpers.answer(() => handle(request)),
  });
  const keysOf = (request: RouteRequest) => ({ tenantId: request.tenantId, cartId: String(request.pathParams.cartId) });
  return [
    route("POST", "/api/carts", async (request) => helpers.reply({ status: 201, body: { cartId: (await actions.createCart({ tenantId: request.tenantId })).cartId } })),
    route("GET", "/api/carts/:cartId", async (request) =>
      helpers.reply({ status: 200, body: await input.describe({ tenantId: request.tenantId, cart: await actions.findCart(keysOf(request)), actions }) }),
    ),
    route("PUT", "/api/carts/:cartId/lines/:productId", async (request) => {
      const body = helpers.readBody({ bodyText: request.bodyText, inputSchema: LINE_SCHEMA });
      const cart = await actions.setLine({ ...keysOf(request), productId: String(request.pathParams.productId), quantity: Number(body.quantity) });
      return helpers.reply({ status: 200, body: await input.describe({ tenantId: request.tenantId, cart, actions }) });
    }),
  ];
}
