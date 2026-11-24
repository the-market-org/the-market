import type { ServiceMap } from "@the-market/core";
import type { PageSection, PagesDatabase } from "./pages-types.ts";

/** The pages a store has. Section definitions say which of these they may appear on. */
export const PAGE_KEYS: readonly string[] = Object.freeze(["home", "product"]);

/** Refuses a page key the storefront does not render. */
export function checkPageKey(pageKey: string): void {
  if (!PAGE_KEYS.includes(pageKey)) {
    throw new Error(`Unknown page: ${pageKey}`);
  }
}

/** Builds the pages module's public services over a storage port. */
export function buildPagesServices(input: { database: PagesDatabase; checkKey: typeof checkPageKey }): ServiceMap {
  return {
    findPage: async (request: { tenantId: string; pageKey: string }) => {
      input.checkKey(request.pageKey);
      return input.database.findPage(request);
    },
    savePage: async (request: { tenantId: string; pageKey: string; sections: PageSection[] }) => {
      input.checkKey(request.pageKey);
      await input.database.savePage(request);
    },
    removePage: async (request: { tenantId: string; pageKey: string }) => {
      input.checkKey(request.pageKey);
      await input.database.removePage(request);
    },
  };
}
