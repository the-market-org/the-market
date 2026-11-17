import type { HttpReply } from "@the-market/core";

/** Answers GET /api/products with the products of the request's store. */
export async function handleListProducts(input: {
  tenantId: string;
  listProducts: (input: { tenantId: string }) => Promise<unknown[]>;
}): Promise<HttpReply> {
  const products = await input.listProducts({ tenantId: input.tenantId });
  return {
    status: 200,
    headers: { "content-type": "application/json" },
    bodyText: JSON.stringify({ products }),
  };
}
