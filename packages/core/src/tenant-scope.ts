/**
 * Row-level security support for a module's Prisma client: every query runs in a transaction that first sets
 * `app.tenant_id` (local to that transaction, so it never leaks across pooled connections) to the tenant id the
 * query names in `where` or `data`. A query that names none sets an empty value, and the policies then show no rows.
 */

type QueryArgs = { where?: { tenantId?: unknown }; data?: { tenantId?: unknown } } | undefined;

/** The tenant id a query names at the top of its `where` or `data`, or "". */
export function readQueryTenant(args: QueryArgs): string {
  const named = args?.where?.tenantId ?? args?.data?.tenantId;
  return typeof named === "string" ? named : "";
}

type ScopableClient = {
  $extends: (extension: unknown) => unknown;
  $transaction: (queries: unknown[]) => Promise<unknown[]>;
  $executeRaw: (sql: TemplateStringsArray, ...values: unknown[]) => unknown;
};

/** The client with every model query wrapped as `set_config('app.tenant_id', …, true)` then the query. */
export function scopeToTenant<Client>(input: { client: Client; readTenant: typeof readQueryTenant }): Client {
  const client = input.client as unknown as ScopableClient;
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations(operation: { args: QueryArgs; query: (args: QueryArgs) => unknown }) {
          const tenantId = input.readTenant(operation.args);
          const [, result] = await client.$transaction([client.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`, operation.query(operation.args)]);
          return result;
        },
      },
    },
  }) as unknown as Client;
}
