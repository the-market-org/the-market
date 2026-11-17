import { defineModule } from "@the-market/core";
import type { ServiceMap } from "@the-market/core";

/**
 * Composition root of the orders module. Its services arrive in a later task;
 * for now it only claims the "orders" PostgreSQL schema.
 */
export function registerOrders(): ServiceMap {
  return {};
}

export const ordersModule = defineModule({
  name: "orders",
  version: "0.0.0",
  schemaName: "orders",
  dependsOn: [],
  register: registerOrders,
});
