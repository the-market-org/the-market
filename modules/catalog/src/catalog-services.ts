import type { ServiceMap } from "@the-market/core";

export interface ProductSummary {
  productId: string;
  handle: string;
  title: string;
  status: string;
  /** Lowest variant price, in the currency's minor unit. */
  priceMinor: number;
  currencyCode: string;
}

export interface NewProduct {
  /** The store the product belongs to. Every catalog row carries it. */
  tenantId: string;
  handle: string;
  title: string;
  sku: string;
  priceMinor: number;
  currencyCode: string;
}

/** What the services need from storage. The Prisma adapter implements it. */
export interface CatalogDatabase {
  /** Returns one tenant's products only. */
  findProducts: (input: { tenantId: string }) => Promise<ProductSummary[]>;
  insertProduct: (product: NewProduct) => Promise<ProductSummary>;
}

type PublishEvent = (eventName: string, payload: unknown) => Promise<void>;

/** Stores a product, then tells the rest of the system it exists. */
export async function addProduct(input: {
  tenantId: string;
  handle: string;
  title: string;
  sku: string;
  priceMinor: number;
  currencyCode: string;
  insertProduct: CatalogDatabase["insertProduct"];
  publishEvent: PublishEvent;
}): Promise<ProductSummary> {
  const product = await input.insertProduct({
    tenantId: input.tenantId,
    handle: input.handle,
    title: input.title,
    sku: input.sku,
    priceMinor: input.priceMinor,
    currencyCode: input.currencyCode,
  });
  await input.publishEvent("catalog.product.created", {
    tenantId: input.tenantId,
    productId: product.productId,
  });
  return product;
}

/** Builds the catalog module's public services over a storage port. */
export function buildCatalogServices(input: {
  database: CatalogDatabase;
  publishEvent: PublishEvent;
  addOne: typeof addProduct;
}): ServiceMap {
  return {
    listProducts: (request: { tenantId: string }) => input.database.findProducts({ tenantId: request.tenantId }),
    addProduct: (product: NewProduct) =>
      input.addOne({
        ...product,
        insertProduct: input.database.insertProduct,
        publishEvent: input.publishEvent,
      }),
  };
}
