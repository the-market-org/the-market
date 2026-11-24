/**
 * The only file in this module that touches Prisma. It implements the
 * PagesDatabase port and is the only place that turns a tenant id into a query filter.
 */
import { PrismaClient } from "./generated/client/index.js";
import type { Prisma } from "./generated/client/index.js";
import type { PageSection, PagesDatabase } from "./pages-types.ts";

export function buildPagesDatabase(input: { databaseUrl: string }): PagesDatabase & { disconnect: () => Promise<void> } {
  const client = new PrismaClient({ datasourceUrl: input.databaseUrl });
  return {
    findPage: async (query) => {
      const records = await client.page.findMany({ where: { tenantId: query.tenantId, pageKey: query.pageKey } });
      return records.map((record) => record.sections as unknown as PageSection[])[0];
    },
    savePage: async (page) => {
      const sections = page.sections as unknown as Prisma.InputJsonValue;
      await client.page.upsert({
        where: { tenantId_pageKey: { tenantId: page.tenantId, pageKey: page.pageKey } },
        create: { tenantId: page.tenantId, pageKey: page.pageKey, sections },
        update: { sections },
      });
    },
    removePage: async (query) => {
      await client.page.deleteMany({ where: { tenantId: query.tenantId, pageKey: query.pageKey } });
    },
    disconnect: () => client.$disconnect(),
  };
}
