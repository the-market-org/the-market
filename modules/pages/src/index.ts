import { defineModule } from "@the-market/core";
import type { ModuleContext, ServiceMap } from "@the-market/core";
import { buildPagesServices, checkPageKey } from "./pages-services.ts";
import { buildPagesDatabase } from "./prisma-pages-database.ts";

export type { PageSection, PagesDatabase } from "./pages-types.ts";
export { PAGE_KEYS } from "./pages-services.ts";

/**
 * Composition root of the pages module: connects the services to the
 * module's own "pages" PostgreSQL schema and nothing else.
 */
export function registerPages(context: ModuleContext): ServiceMap {
  return buildPagesServices({ database: buildPagesDatabase({ databaseUrl: context.databaseUrl }), checkKey: checkPageKey });
}

export const pagesModule = defineModule({
  name: "pages",
  version: "0.0.0",
  schemaName: "pages",
  dependsOn: [],
  register: registerPages,
});
