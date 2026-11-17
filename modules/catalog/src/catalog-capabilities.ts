import type { CapabilityDefinition } from "@the-market/core";

/** The input a rename takes; also the shape of its change and its revert. */
interface RenameRequest {
  productId: string;
  title: string;
}

type FindProduct = (input: { tenantId: string; productId: string }) => Promise<{ title: string } | undefined>;
type RenameProduct = (input: { tenantId: string; productId: string; title: string }) => Promise<void>;

export const RENAME_INPUT_SCHEMA: Record<string, unknown> = Object.freeze({
  type: "object",
  required: ["productId", "title"],
  properties: { productId: { type: "string" }, title: { type: "string" } },
});

/** `catalog.product.rename`: changes a product's title, and can put the old one back. */
export function buildRenameCapability(input: {
  findProduct: FindProduct;
  renameProduct: RenameProduct;
}): CapabilityDefinition {
  const capabilityName = "catalog.product.rename";
  return {
    name: capabilityName,
    summary: "Change a product's title",
    inputSchema: RENAME_INPUT_SCHEMA,
    risk: "low",
    buildChange: async (request) => {
      const candidate = request.candidate as RenameRequest;
      const product = await input.findProduct({ tenantId: request.tenantId, productId: candidate.productId });
      if (product === undefined) {
        throw new Error("Product not found");
      }
      return {
        capabilityName,
        tenantId: request.tenantId,
        summary: `Rename "${product.title}" to "${candidate.title}"`,
        change: { productId: candidate.productId, title: candidate.title },
        revert: { productId: candidate.productId, title: product.title },
      };
    },
    applyChange: (request) => input.renameProduct({ tenantId: request.tenantId, ...(request.change as RenameRequest) }),
    revertChange: (request) => input.renameProduct({ tenantId: request.tenantId, ...(request.revert as RenameRequest) }),
  };
}

/** The catalog's capabilities, built over its own registered services. */
export function listCatalogCapabilities(input: {
  services: Record<string, unknown>;
  buildRename: typeof buildRenameCapability;
}): CapabilityDefinition[] {
  return [
    input.buildRename({
      findProduct: input.services.findProduct as FindProduct,
      renameProduct: input.services.renameProduct as RenameProduct,
    }),
  ];
}
