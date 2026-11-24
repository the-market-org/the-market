/** Preview: a page rendered as if a change set's page changes were applied, without applying them. */
import type { HttpReply } from "@the-market/core";
import type { ChangeItemRecord, ChangeSetRecord } from "@the-market/module-changes";
import type { PageSection } from "@the-market/theme-engine";
import type { StorefrontSteps, renderStorePage } from "./storefront-handlers.ts";

/** The sections the change set would give this page: its last `pages.page.set-sections` item for the page. */
export function findPreviewSections(input: { items: ChangeItemRecord[]; pageKey: string }): PageSection[] | undefined {
  return input.items
    .map((item) => ({ capabilityName: item.capabilityName, change: item.change as { pageKey?: string; sections?: PageSection[] } }))
    .filter((item) => item.capabilityName === "pages.page.set-sections" && item.change.pageKey === input.pageKey)
    .map((item) => item.change.sections ?? [])
    .at(-1);
}

export async function handlePreview(input: {
  tenantId: string;
  changeSetId: string;
  pageKey: string;
  handle: string;
  findSet: (request: { tenantId: string; changeSetId: string }) => Promise<ChangeSetRecord | undefined>;
  findSections: typeof findPreviewSections;
  steps: StorefrontSteps;
  renderPage: typeof renderStorePage;
}): Promise<HttpReply> {
  const changeSet = await input.findSet({ tenantId: input.tenantId, changeSetId: input.changeSetId });
  if (changeSet === undefined) {
    throw new Error("Change set not found");
  }
  const previewSections = input.findSections({ items: changeSet.items, pageKey: input.pageKey });
  const products = await input.steps.listProducts({ tenantId: input.tenantId });
  const product = products.find((candidate) => candidate.handle === input.handle) ?? products[0];
  const steps: StorefrontSteps = {
    ...input.steps,
    findPage: async (request) => previewSections ?? input.steps.findPage(request),
  };
  return input.renderPage({ tenantId: input.tenantId, pageKey: input.pageKey, product, products, steps });
}
