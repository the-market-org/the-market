import { defineModule } from "@the-market/core";
import type { ModuleContext, ServiceMap } from "@the-market/core";
import { addProduct, buildCatalogServices } from "./catalog-services.ts";
import { buildCatalogDatabase, summariseProduct } from "./prisma-catalog-database.ts";

export type { NewProduct, ProductSummary } from "./catalog-services.ts";

/**
 * Composition root of the catalog module: connects the services to the
 * module's own "catalog" PostgreSQL schema and nothing else.
 */
export function registerCatalog(context: ModuleContext): ServiceMap {
  const database = buildCatalogDatabase({ databaseUrl: context.databaseUrl, summarise: summariseProduct });
  return buildCatalogServices({ database, publishEvent: context.publishEvent, addOne: addProduct });
}

export const catalogModule = defineModule({
  name: "catalog",
  version: "0.0.0",
  schemaName: "catalog",
  dependsOn: [],
  register: registerCatalog,
});
