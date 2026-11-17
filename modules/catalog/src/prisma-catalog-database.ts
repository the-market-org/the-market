/**
 * The only file in this module that touches Prisma. It implements the
 * CatalogDatabase port, so storage can be replaced here alone.
 * It is also the only place that turns a tenant id into a query filter.
 */
import type { CatalogDatabase, ProductSummary } from "./catalog-services.ts";
import { PrismaClient } from "./generated/client/index.js";

interface ProductRecord {
  productId: string;
  handle: string;
  title: string;
  status: string;
  variants: Array<{ priceMinor: number; currencyCode: string }>;
}

/** Reduces a stored product and its variants to the public summary. */
export function summariseProduct(record: ProductRecord): ProductSummary {
  const cheapest = [...record.variants].sort((first, second) => first.priceMinor - second.priceMinor)[0];
  return {
    productId: record.productId,
    handle: record.handle,
    title: record.title,
    status: record.status,
    priceMinor: cheapest?.priceMinor ?? 0,
    currencyCode: cheapest?.currencyCode ?? "",
  };
}

export function buildCatalogDatabase(input: {
  databaseUrl: string;
  summarise: (record: ProductRecord) => ProductSummary;
}): CatalogDatabase & { disconnect: () => Promise<void> } {
  const client = new PrismaClient({ datasourceUrl: input.databaseUrl });
  return {
    findProducts: async (query) => {
      const records = await client.product.findMany({
        where: { tenantId: query.tenantId },
        include: { variants: true },
        orderBy: { title: "asc" },
      });
      return records.map((record) => input.summarise(record));
    },
    insertProduct: async (product) => {
      const record = await client.product.create({
        data: {
          tenantId: product.tenantId,
          handle: product.handle,
          title: product.title,
          status: "active",
          variants: {
            create: {
              tenantId: product.tenantId,
              sku: product.sku,
              title: "Default",
              priceMinor: product.priceMinor,
              currencyCode: product.currencyCode,
            },
          },
        },
        include: { variants: true },
      });
      return input.summarise(record);
    },
    findProductById: async (query) => {
      const records = await client.product.findMany({
        where: { tenantId: query.tenantId, productId: query.productId },
        include: { variants: true },
      });
      return records.map((record) => input.summarise(record))[0];
    },
    updateProductTitle: async (change) => {
      const result = await client.product.updateMany({
        where: { tenantId: change.tenantId, productId: change.productId },
        data: { title: change.title },
      });
      return result.count;
    },
    disconnect: () => client.$disconnect(),
  };
}
