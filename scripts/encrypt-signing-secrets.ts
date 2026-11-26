/**
 * Seals agent connection signing secrets stored before sealing existed. Run once, with SECRETS_KEY set:
 *   node --env-file-if-exists=.env scripts/encrypt-signing-secrets.ts
 * Already sealed rows are left alone, so running it again changes nothing. No secret is ever printed.
 */
import { buildModuleDatabaseUrl } from "@the-market/core";
import { PrismaClient } from "../modules/connections/src/generated/client/index.js";
import { isSealed, readSecretsKey, sealSecret } from "../modules/connections/src/secret-box.ts";

type StoredRow = { tenantId: string; signingSecret: string };

/** The updates that seal every plain row; sealed rows need none. */
export function planSealing(input: { rows: StoredRow[]; seal: (plain: string) => string; sealed: typeof isSealed }): StoredRow[] {
  return input.rows.filter((row) => !input.sealed(row.signingSecret)).map((row) => ({ tenantId: row.tenantId, signingSecret: input.seal(row.signingSecret) }));
}

async function main(environment: Readonly<Record<string, string | undefined>>): Promise<void> {
  const key = readSecretsKey(String(environment.SECRETS_KEY ?? ""));
  const client = new PrismaClient({ datasourceUrl: buildModuleDatabaseUrl({ databaseUrl: String(environment.DATABASE_URL), schemaName: "connections" }) });
  try {
    const rows = await client.agentConnection.findMany({ select: { tenantId: true, signingSecret: true } });
    const updates = planSealing({ rows, seal: (plain) => sealSecret({ plain, key }), sealed: isSealed });
    for (const update of updates) {
      await client.agentConnection.update({ where: { tenantId: update.tenantId }, data: { signingSecret: update.signingSecret } });
    }
    console.log(`Sealed ${updates.length} of ${rows.length} signing secrets`);
  } finally {
    await client.$disconnect();
  }
}

if (import.meta.main) {
  await main(process.env);
}
