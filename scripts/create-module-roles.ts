/**
 * Gives each module its own database role, allowed only into its own schema, without BYPASSRLS, not an owner.
 * Run with the owner's DATABASE_URL (a user allowed to create roles):
 *   node --env-file-if-exists=.env scripts/create-module-roles.ts
 * A role that exists gets a new password. Each module's connection is written to `.env.module-roles`
 * (git-ignored) as <SCHEMA>_DATABASE_URL. No password is ever printed.
 */
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "../modules/catalog/src/generated/client/index.js";

export const MODULE_SCHEMAS: readonly string[] = Object.freeze(["tenancy", "catalog", "changes", "pages", "connections", "carts", "orders", "apps", "experiments"]);
const SAFE_NAME = /^[a-z_]+$/;
const SAFE_PASSWORD = /^[0-9a-f]{48}$/;

/** The SQL that creates or updates one module's role and grants it its own schema only. */
export function buildRoleStatements(input: { schemaName: string; roleName: string; password: string; exists: boolean }): string[] {
  const safe = SAFE_NAME.test(input.schemaName) && SAFE_NAME.test(input.roleName) && SAFE_PASSWORD.test(input.password);
  if (!safe) {
    throw new Error("Refusing a schema, role or password outside the expected characters");
  }
  const attributes = `LOGIN PASSWORD '${input.password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT`;
  const { schemaName: schema, roleName: role } = input;
  return [
    input.exists ? `ALTER ROLE ${role} WITH ${attributes}` : `CREATE ROLE ${role} WITH ${attributes}`,
    `GRANT USAGE ON SCHEMA ${schema} TO ${role}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${role}`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
  ];
}

/** The owner's URL with the module role signed in instead: on the pooler the user is `<role>.<project ref>`. */
export function buildRoleUrl(input: { databaseUrl: string; roleName: string; password: string }): string {
  const url = new URL(input.databaseUrl);
  const projectRef = decodeURIComponent(url.username).split(".")[1];
  url.username = projectRef === undefined ? input.roleName : `${input.roleName}.${projectRef}`;
  url.password = input.password;
  return url.toString();
}

async function main(environment: Readonly<Record<string, string | undefined>>): Promise<void> {
  const databaseUrl = String(environment.DATABASE_URL);
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const lines: string[] = ["# Written by scripts/create-module-roles.ts. One database role per module; keep this file private."];
  try {
    for (const schemaName of MODULE_SCHEMAS) {
      const roleName = `market_${schemaName}`;
      const password = randomBytes(24).toString("hex");
      const found = await client.$queryRawUnsafe<unknown[]>("SELECT 1 FROM pg_roles WHERE rolname = $1", roleName);
      for (const statement of buildRoleStatements({ schemaName, roleName, password, exists: found.length > 0 })) {
        await client.$executeRawUnsafe(statement);
      }
      lines.push(`${schemaName.toUpperCase()}_DATABASE_URL=${buildRoleUrl({ databaseUrl, roleName, password })}`);
      console.log(`${found.length > 0 ? "Updated" : "Created"} ${roleName}`);
    }
  } finally {
    await client.$disconnect();
  }
  await writeFile(".env.module-roles", `${lines.join("\n")}\n`, { mode: 0o600 });
  console.log(`Wrote ${MODULE_SCHEMAS.length} connection settings to .env.module-roles`);
}

if (import.meta.main) {
  await main(process.env);
}
