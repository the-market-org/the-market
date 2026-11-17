/** Composition of the shopper routes. Services are looked up when a request arrives. */
import { listInputProblems, resolveService, runWorkflow, undoCompletedSteps } from "@the-market/core";
import { buildFakeProvider } from "@the-market/payment";
import type { PaymentProvider } from "@the-market/payment";
import type { ModuleRegistry } from "@the-market/core";
import { answerChangeSetError, answerSafely, parseJsonBody, readCheckedBody, replyJson } from "../change-sets/change-set-http.ts";
import type { RouteHelpers } from "../change-sets/change-set-routes.ts";
import { describeError } from "../change-sets/item-steps.ts";
import type { Route } from "../hono-adapter.ts";
import { buildCartRoutes, describeCart } from "./cart-routes.ts";
import type { CartActions } from "./cart-routes.ts";
import { buildCheckoutSteps, loadOpenCart } from "./checkout-workflow.ts";
import type { CheckoutActions } from "./checkout-workflow.ts";
import { priceCart, priceLine } from "./price-cart.ts";

/** Without a configured provider, checkout uses the fake one, which never declines. */
export function composeShopperRoutes(input: { registry: ModuleRegistry; paymentProvider: PaymentProvider | undefined }): Route[] {
  const call = (moduleName: string, serviceName: string) => (request: unknown) =>
    (resolveService({ registry: input.registry, moduleName, serviceName }) as (request: unknown) => Promise<never>)(request);
  const actions: CartActions = {
    createCart: call("carts", "createCart"),
    findCart: call("carts", "findCart"),
    setLine: call("carts", "setLine"),
    listProducts: call("catalog", "listProducts"),
    priceLines: (request) => priceCart({ ...request, priceOne: priceLine }),
  };
  const helpers: RouteHelpers = {
    readBody: (request) => readCheckedBody({ ...request, parse: parseJsonBody, listProblems: listInputProblems }),
    reply: replyJson,
    answer: (run) => answerSafely({ run, answerError: answerChangeSetError, describe: describeError }),
  };
  const checkoutActions: CheckoutActions = {
    findCart: call("carts", "findCart"),
    placeOrder: call("orders", "placeOrder"),
    cancelOrder: call("orders", "cancelOrder"),
    markPaid: call("orders", "markPaid"),
    markConverted: call("carts", "markConverted"),
    provider: input.paymentProvider ?? buildFakeProvider({ declineAmountMinor: -1 }),
  };
  const steps = buildCheckoutSteps(checkoutActions);
  return [
    ...buildCartRoutes({ actions, helpers, describe: describeCart }),
    {
      method: "POST",
      path: "/api/carts/:cartId/checkout",
      tenantScoped: true,
      handleRequest: (request) =>
        helpers.answer(async () => {
          const keys = { tenantId: request.tenantId, cartId: String(request.pathParams.cartId) };
          const lines = await loadOpenCart({ ...keys, findCart: checkoutActions.findCart });
          const priced = actions.priceLines({ lines, products: await actions.listProducts({ tenantId: keys.tenantId }) });
          const done = await runWorkflow({ steps, initialState: { ...keys, priced, orderId: "", orderNumber: 0, paymentReference: "" }, describe: describeError, undoSteps: undoCompletedSteps });
          return helpers.reply({ status: 201, body: { orderId: done.orderId, orderNumber: done.orderNumber, status: "paid", totalMinor: priced.totalMinor, currencyCode: priced.currencyCode } });
        }),
    },
  ];
}
