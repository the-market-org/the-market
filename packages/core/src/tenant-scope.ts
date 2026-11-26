/**
 * Row-level security support for a module's Prisma client: every query runs in a transaction that first sets
 * `app.tenant_id` (local to that transaction, so it never leaks across pooled connections) to the tenant id the
 * query names in `where` or `data`. A query that names none sets an empty value, and the policies then show no rows.
 */

type QueryArgs = { where?: Record<string, unknown>; data?: { tenantId?: unknown }; create?: { tenantId?: unknown } } | undefined;

/** The tenant id inside a compound unique key such as `{ tenantId_pageKey: { tenantId, pageKey } }`, if any. */
export function readCompoundTenant(where: Record<string, unknown>): unknown {
  const keys = Object.values(where).filter((value): value is { tenantId?: unknown } => typeof value === "object" && value !== null);
  return keys.find((key) => typeof key.tenantId === "string")?.tenantId;
}

/** The tenant id a query names in `where`, a compound key in `where`, `data`, or an upsert's `create`; or "". */
export function readQueryTenant(args: QueryArgs): string {
  const named = args?.where?.tenantId ?? readCompoundTenant(args?.where ?? {}) ?? args?.data?.tenantId ?? args?.create?.tenantId;
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

type TransactionRunner = { $transaction: (work: (transaction: { $executeRaw: ScopableClient["$executeRaw"] }) => Promise<unknown>) => Promise<unknown> };

/**
 * Runs work in one interactive transaction that first sets each named setting (local to the transaction). Tenancy
 * uses `app.host` and `app.slug` to find a store before any tenant is known; other modules use `app.tenant_id`.
 */
export function runWithSettings<Transaction, Result>(input: { client: unknown; settings: Readonly<Record<string, string>>; work: (transaction: Transaction) => Promise<Result> }): Promise<Result> {
  const client = input.client as TransactionRunner;
  return client.$transaction(async (transaction) => {
    for (const [name, value] of Object.entries(input.settings)) {
      await transaction.$executeRaw`SELECT set_config(${name}, ${value}, true)`;
    }
    return input.work(transaction as unknown as Transaction);
  }) as Promise<Result>;
}

/**
 * Runs work in one interactive transaction that first sets `app.tenant_id`. For modules whose writes need their
 * own transaction (a counter read then an insert), where `scopeToTenant`'s per-query transaction cannot nest.
 */
export function runAsTenant<Transaction, Result>(input: { client: unknown; tenantId: string; work: (transaction: Transaction) => Promise<Result> }): Promise<Result> {
  return runWithSettings({ client: input.client, settings: { "app.tenant_id": input.tenantId }, work: input.work });
}
