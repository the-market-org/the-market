/** Composition of the shopper routes. Services are looked up when a request arrives. */
import { listInputProblems, resolveService } from "@the-market/core";
import type { ModuleRegistry } from "@the-market/core";
import { answerChangeSetError, answerSafely, parseJsonBody, readCheckedBody, replyJson } from "../change-sets/change-set-http.ts";
import type { RouteHelpers } from "../change-sets/change-set-routes.ts";
import { describeError } from "../change-sets/item-steps.ts";
import type { Route } from "../hono-adapter.ts";
import { buildCartRoutes, describeCart } from "./cart-routes.ts";
import type { CartActions } from "./cart-routes.ts";
import { priceCart, priceLine } from "./price-cart.ts";

export function composeShopperRoutes(input: { registry: ModuleRegistry }): Route[] {
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
  return buildCartRoutes({ actions, helpers, describe: describeCart });
}
