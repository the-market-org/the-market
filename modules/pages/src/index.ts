import { defineModule } from "@the-market/core";
import type { ServiceMap } from "@the-market/core";

export type { PageSection, PagesDatabase } from "./pages-types.ts";

/**
 * Composition root of the pages module. Its services arrive in a later task;
 * for now it only claims the "pages" PostgreSQL schema.
 */
export function registerPages(): ServiceMap {
  return {};
}

export const pagesModule = defineModule({
  name: "pages",
  version: "0.0.0",
  schemaName: "pages",
  dependsOn: [],
  register: registerPages,
});
