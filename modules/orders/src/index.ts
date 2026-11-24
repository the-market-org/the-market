import { defineModule } from "@the-market/core";
import type { ModuleContext, ServiceMap } from "@the-market/core";
import { buildOrdersServices, explainRefusedOrderMove, moveOrder } from "./orders-services.ts";
import { buildOrdersDatabase } from "./prisma-orders-database.ts";

export type { OrderLineRecord, OrderRecord, OrdersDatabase } from "./orders-types.ts";

/**
 * Composition root of the orders module: connects the services to the
 * module's own "orders" PostgreSQL schema and nothing else.
 */
export function registerOrders(context: ModuleContext): ServiceMap {
  return buildOrdersServices({
    database: buildOrdersDatabase({ databaseUrl: context.databaseUrl }),
    move: moveOrder,
    explain: explainRefusedOrderMove,
    publishEvent: context.publishEvent,
  });
}

export const ordersModule = defineModule({
  name: "orders",
  version: "0.0.0",
  schemaName: "orders",
  dependsOn: [],
  register: registerOrders,
});
