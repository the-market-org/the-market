/** Storefront cart pages: add, view, pay, thanks. The cart is found by an HttpOnly, SameSite=Lax `cart_id` cookie. */
import type { HttpReply } from "@the-market/core";
import type { CartPageLine } from "@the-market/theme-engine";
import type { Route, RouteRequest } from "../hono-adapter.ts";
import type { CatalogProduct, PricedCart } from "../checkout/price-cart.ts";

type Cart = { cartId: string; status: string; lines: Array<{ productId: string; quantity: number }> };
type Keys = { tenantId: string; cartId: string };

export interface CartPageSteps {
  findStoreName: (input: { tenantId: string }) => Promise<string>;
  createCart: (input: { tenantId: string }) => Promise<Cart>;
  findCart: (input: Keys) => Promise<Cart | undefined>;
  setLine: (input: Keys & { productId: string; quantity: number }) => Promise<unknown>;
  listProducts: (input: { tenantId: string }) => Promise<CatalogProduct[]>;
  priceLines: (input: { lines: Cart["lines"]; products: CatalogProduct[] }) => PricedCart;
  checkOut: (input: Keys) => Promise<{ orderId: string }>;
  findOrder: (input: { tenantId: string; orderId: string }) => Promise<{ orderNumber: number; status: string; totalMinor: number; currencyCode: string } | undefined>;
  formatPrice: (input: { priceMinor: number; currencyCode: string }) => string;
  renderCart: (input: { storeName: string; lines: CartPageLine[]; totalText: string; errorMessage: string }) => string;
  renderOrder: (input: { storeName: string; orderNumber: number; totalText: string }) => string;
  statusFor: (message: string) => number;
  describe: (error: unknown) => string;
  recordEvent: (event: { tenantId: string; visitorKey: string; eventName: string; pageKey: string }) => void;
  /** Shared cookie attributes, with `Secure` outside development. */
  cookieAttributes: string;
}

const CART_COOKIE = "cart_id";
const VISITOR_COOKIE = "visitor_id";

/** The shopper's anonymous visitor key, or "" when they have none. */
function readVisitor(request: RouteRequest): string {
  return readCookie({ cookieHeader: String(request.headerValues.cookie), cookieName: VISITOR_COOKIE });
}
// Adding past 99 in total is refused by the carts service.

/** One cookie's value from a Cookie header, or "". */
export function readCookie(input: { cookieHeader: string; cookieName: string }): string {
  const pair = input.cookieHeader.split(";").map((part) => part.trim().split("=")).find(([name]) => name === input.cookieName);
  return pair === undefined ? "" : decodeURIComponent(pair.slice(1).join("="));
}

function replyHtml(input: { status: number; html: string; headers?: Record<string, string> }): HttpReply {
  return { status: input.status, headers: { "content-type": "text/html; charset=utf-8", ...input.headers }, bodyText: input.html };
}

/** A cart only while it is open. */
function keepOpen(cart: Cart | undefined): Cart | undefined {
  return cart?.status === "open" ? cart : undefined;
}

/** A product's quantity already in the lines, or 0. */
function quantityIn(input: { lines: Cart["lines"]; productId: string }): number {
  return input.lines.find((line) => line.productId === input.productId)?.quantity ?? 0;
}

/** The shopper's open cart, or undefined when there is none yet (or it was checked out). */
async function findOpenCart(input: { request: RouteRequest; steps: CartPageSteps }): Promise<Cart | undefined> {
  const cartId = readCookie({ cookieHeader: String(input.request.headerValues.cookie), cookieName: CART_COOKIE });
  return keepOpen(cartId === "" ? undefined : await input.steps.findCart({ tenantId: input.request.tenantId, cartId }));
}

/** The cart page, with its lines priced from the catalog; empty when there is no cart. */
async function renderCartPage(input: { tenantId: string; cart: Cart | undefined; errorMessage: string; steps: CartPageSteps }): Promise<string> {
  const { steps } = input;
  const lines = input.cart === undefined ? [] : input.cart.lines;
  const priced = lines.length === 0 ? { currencyCode: "GBP", totalMinor: 0, lines: [] } : steps.priceLines({ lines, products: await steps.listProducts({ tenantId: input.tenantId }) });
  const text = (priceMinor: number) => steps.formatPrice({ priceMinor, currencyCode: priced.currencyCode });
  const pageLines = priced.lines.map((line) => ({ title: line.title, quantity: line.quantity, lineTotalText: text(line.lineTotalMinor) }));
  return steps.renderCart({ storeName: await steps.findStoreName({ tenantId: input.tenantId }), lines: pageLines, totalText: text(priced.totalMinor), errorMessage: input.errorMessage });
}

/** Runs a page handler; an error becomes a short page with the status its message maps to. */
async function answerPage(input: { run: () => Promise<HttpReply>; steps: CartPageSteps }): Promise<HttpReply> {
  try {
    return await input.run();
  } catch (error) {
    const message = input.steps.describe(error);
    return replyHtml({ status: input.steps.statusFor(message), html: `<!doctype html><title>Sorry</title><p>${message.replace(/[&<>"']/g, "")}</p>` });
  }
}

export function buildCartPageRoutes(steps: CartPageSteps): Route[] {
  const page = (method: Route["method"], path: string, handle: (request: RouteRequest) => Promise<HttpReply>): Route => ({
    method,
    path,
    tenantScoped: true,
    handleRequest: (request) => answerPage({ run: () => handle(request), steps }),
  });
  return [
    page("POST", "/cart/lines", async (request) => {
      const form = new URLSearchParams(request.bodyText);
      const productId = String(form.get("productId"));
      const cart = (await findOpenCart({ request, steps })) ?? (await steps.createCart({ tenantId: request.tenantId }));
      const quantity = quantityIn({ lines: cart.lines, productId }) + Number(form.get("quantity"));
      await steps.setLine({ tenantId: request.tenantId, cartId: cart.cartId, productId, quantity });
      steps.recordEvent({ tenantId: request.tenantId, visitorKey: readVisitor(request), eventName: "add_to_cart", pageKey: "product" });
      return replyHtml({ status: 303, html: "", headers: { location: "/cart", "set-cookie": `${CART_COOKIE}=${cart.cartId}; ${steps.cookieAttributes}; Max-Age=2592000` } });
    }),
    page("GET", "/cart", async (request) =>
      replyHtml({ status: 200, html: await renderCartPage({ tenantId: request.tenantId, cart: await findOpenCart({ request, steps }), errorMessage: "", steps }) }),
    ),
    page("POST", "/cart/checkout", async (request) => {
      const cart = await findOpenCart({ request, steps });
      const outcome = await steps.checkOut({ tenantId: request.tenantId, cartId: String(cart?.cartId) }).catch((error: unknown) => ({ failure: steps.describe(error) }));
      steps.recordEvent({ tenantId: request.tenantId, visitorKey: "failure" in outcome ? "" : readVisitor(request), eventName: "checkout_paid", pageKey: "cart" });
      return "failure" in outcome
        ? replyHtml({ status: 422, html: await renderCartPage({ tenantId: request.tenantId, cart, errorMessage: outcome.failure, steps }) })
        : replyHtml({ status: 303, html: "", headers: { location: `/orders/${outcome.orderId}`, "set-cookie": `${CART_COOKIE}=; ${steps.cookieAttributes}; Max-Age=0` } });
    }),
    page("GET", "/orders/:orderId", async (request) => {
      const order = await steps.findOrder({ tenantId: request.tenantId, orderId: String(request.pathParams.orderId) });
      if (order?.status !== "paid") {
        throw new Error("Order not found");
      }
      const totalText = steps.formatPrice({ priceMinor: order.totalMinor, currencyCode: order.currencyCode });
      return replyHtml({ status: 200, html: steps.renderOrder({ storeName: await steps.findStoreName({ tenantId: request.tenantId }), orderNumber: order.orderNumber, totalText }) });
    }),
  ];
}
