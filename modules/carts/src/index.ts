import { defineModule } from "@the-market/core";
import type { ModuleContext, ServiceMap } from "@the-market/core";
import { buildCartsServices, checkLine, requireOpenCart } from "./carts-services.ts";
import { buildCartsDatabase } from "./prisma-carts-database.ts";

export type { CartLineRecord, CartRecord, CartsDatabase } from "./carts-types.ts";

/**
 * Composition root of the carts module: connects the services to the
 * module's own "carts" PostgreSQL schema and nothing else.
 */
export function registerCarts(context: ModuleContext): ServiceMap {
  return buildCartsServices({ database: buildCartsDatabase({ databaseUrl: context.databaseUrl }), check: checkLine, requireOpen: requireOpenCart });
}

export const cartsModule = defineModule({
  name: "carts",
  version: "0.0.0",
  schemaName: "carts",
  dependsOn: [],
  register: registerCarts,
});
