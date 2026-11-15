import { defineModule } from "@the-market/core";
import type { ModuleContext, ServiceMap } from "@the-market/core";

interface ProductSummary {
  productId: string;
  title: string;
  priceMinor: number;
  currencyCode: string;
}

/**
 * Registers the catalog services.
 * The prototype keeps products in memory; the real module reads its own
 * "catalog" PostgreSQL schema and nothing else.
 */
export function registerCatalog(context: ModuleContext): ServiceMap {
  const products: ProductSummary[] = [];
  return {
    listProducts: async (): Promise<ProductSummary[]> => [...products],
    addProduct: async (product: ProductSummary): Promise<void> => {
      products.push(product);
      await context.publishEvent("catalog.product.created", { productId: product.productId });
    },
  };
}

export const catalogModule = defineModule({
  name: "catalog",
  version: "0.0.0",
  schemaName: "catalog",
  dependsOn: [],
  register: registerCatalog,
});
