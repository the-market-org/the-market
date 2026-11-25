/** One section of a page: which theme section, and its settings. Stored as data by the pages module. */
export interface PageSection {
  sectionType: string;
  settings: Record<string, unknown>;
}

/** A product as a section sees it: plain, already formatted values. */
export interface ProductCard {
  productId: string;
  handle: string;
  title: string;
  priceText: string;
}

/** Everything a page's sections may show. `product` is set on a product page only. */
export interface PageData {
  storeName: string;
  products: ProductCard[];
  product: ProductCard | undefined;
  /** App fragments per slot name, already sanitised and wrapped by the server. */
  slots: Readonly<Record<string, string>>;
}

/** A section shipped by the theme: code, with a settings schema the agent can fill. */
export interface SectionDefinition {
  sectionType: string;
  /** The pages it may be used on: "home", "product". */
  pageKeys: readonly string[];
  /** Same schema subset as capability input. */
  settingsSchema: Record<string, unknown>;
  renderSection: (input: {
    settings: Record<string, unknown>;
    pageData: PageData;
    escape: (text: string) => string;
    readText: (value: unknown) => string;
  }) => string;
}
