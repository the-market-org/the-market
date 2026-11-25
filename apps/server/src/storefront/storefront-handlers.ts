/** Storefront pages: plain values in, an HTML reply out. */
import type { HttpReply } from "@the-market/core";
import type { PageData, PageSection, ProductCard } from "@the-market/theme-engine";

export interface StoreProduct {
  productId: string;
  handle: string;
  title: string;
  priceMinor: number;
  currencyCode: string;
}

/** What the storefront reads from the modules, and how it renders. */
export interface StorefrontSteps {
  findStoreName: (input: { tenantId: string }) => Promise<string>;
  listProducts: (input: { tenantId: string }) => Promise<StoreProduct[]>;
  findPage: (input: { tenantId: string; pageKey: string }) => Promise<PageSection[] | undefined>;
  defaultPages: Readonly<Record<string, PageSection[]>>;
  toCard: (product: StoreProduct) => ProductCard;
  render: (input: { sections: PageSection[]; pageData: PageData }) => string;
  loadSlots: (input: { tenantId: string; slotNames: string[]; pageValues: Record<string, string> }) => Promise<Record<string, string>>;
}

export function replyHtml(input: { status: number; html: string }): HttpReply {
  return { status: input.status, headers: { "content-type": "text/html; charset=utf-8" }, bodyText: input.html };
}

/** Renders one page of the store: the saved page, or the default one. */
export async function renderStorePage(input: {
  tenantId: string;
  pageKey: string;
  product: StoreProduct | undefined;
  products: StoreProduct[];
  steps: StorefrontSteps;
}): Promise<HttpReply> {
  const { steps } = input;
  const [storeName, saved] = await Promise.all([
    steps.findStoreName({ tenantId: input.tenantId }),
    steps.findPage({ tenantId: input.tenantId, pageKey: input.pageKey }),
  ]);
  const sections = saved ?? steps.defaultPages[input.pageKey] ?? [];
  const slotNames = sections.filter((section) => section.sectionType === "app-slot").map((section) => String(section.settings.slotName));
  const pageValues = { productHandle: String(input.product?.handle ?? ""), productTitle: String(input.product?.title ?? "") };
  const pageData: PageData = {
    storeName,
    products: input.products.map(steps.toCard),
    product: input.product === undefined ? undefined : steps.toCard(input.product),
    slots: await steps.loadSlots({ tenantId: input.tenantId, slotNames, pageValues }),
  };
  return replyHtml({ status: 200, html: steps.render({ sections, pageData }) });
}

export async function handleHomePage(input: { tenantId: string; steps: StorefrontSteps; renderPage: typeof renderStorePage }): Promise<HttpReply> {
  const products = await input.steps.listProducts({ tenantId: input.tenantId });
  return input.renderPage({ tenantId: input.tenantId, pageKey: "home", product: undefined, products, steps: input.steps });
}

const PRODUCT_NOT_FOUND = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Product not found</title></head><body><main><h1>Product not found</h1></main></body></html>';

export async function handleProductPage(input: {
  tenantId: string;
  handle: string;
  steps: StorefrontSteps;
  renderPage: typeof renderStorePage;
}): Promise<HttpReply> {
  const products = await input.steps.listProducts({ tenantId: input.tenantId });
  const product = products.find((candidate) => candidate.handle === input.handle);
  if (product === undefined) {
    return replyHtml({ status: 404, html: PRODUCT_NOT_FOUND });
  }
  return input.renderPage({ tenantId: input.tenantId, pageKey: "product", product, products, steps: input.steps });
}
