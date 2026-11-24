import { defineModule } from "@the-market/core";
import type { ServiceMap } from "@the-market/core";

export type { CartLineRecord, CartRecord, CartsDatabase } from "./carts-types.ts";

/**
 * Composition root of the carts module. Its services arrive in a later task;
 * for now it only claims the "carts" PostgreSQL schema.
 */
export function registerCarts(): ServiceMap {
  return {};
}

export const cartsModule = defineModule({
  name: "carts",
  version: "0.0.0",
  schemaName: "carts",
  dependsOn: [],
  register: registerCarts,
});
