/** One section of a page: which theme section, and its settings. */
export interface PageSection {
  sectionType: string;
  settings: Record<string, unknown>;
}

/** What the services need from storage. The Prisma adapter implements it. */
export interface PagesDatabase {
  /** Returns the page's sections in order, or undefined when the tenant has not saved that page. */
  findPage: (input: { tenantId: string; pageKey: string }) => Promise<PageSection[] | undefined>;
  /** Creates the page or replaces its sections. */
  savePage: (input: { tenantId: string; pageKey: string; sections: PageSection[] }) => Promise<void>;
  removePage: (input: { tenantId: string; pageKey: string }) => Promise<void>;
}
