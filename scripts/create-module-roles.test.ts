import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRoleStatements, buildRoleUrl } from "./create-module-roles.ts";

const password = "a".repeat(48);

test("a module role can sign in but bypasses nothing, and is granted only its own schema", () => {
  const statements = buildRoleStatements({ schemaName: "catalog", roleName: "market_catalog", password, exists: false });
  assert.match(String(statements[0]), /^CREATE ROLE market_catalog WITH LOGIN PASSWORD '.+' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT$/);
  assert.ok(statements.slice(1).every((statement) => statement.includes("SCHEMA catalog ") && statement.endsWith(" TO market_catalog")));
  assert.match(String(buildRoleStatements({ schemaName: "catalog", roleName: "market_catalog", password, exists: true })[0]), /^ALTER ROLE market_catalog WITH/);
});

test("names and passwords outside the expected characters are refused, so nothing can be injected", () => {
  for (const input of [{ schemaName: "catalog; DROP", roleName: "market_catalog", password }, { schemaName: "catalog", roleName: "market_catalog", password: "x' OR 1=1" }]) {
    assert.throws(() => buildRoleStatements({ ...input, exists: false }), { message: "Refusing a schema, role or password outside the expected characters" });
  }
});

test("the role's URL keeps the pooler's project suffix and swaps in the role and its password", () => {
  const url = new URL(buildRoleUrl({ databaseUrl: "postgresql://postgres.abcd1234:owner@pooler.example:5432/postgres", roleName: "market_catalog", password }));
  assert.deepEqual([url.username, url.password, url.host, url.pathname], ["market_catalog.abcd1234", password, "pooler.example:5432", "/postgres"]);
  assert.equal(new URL(buildRoleUrl({ databaseUrl: "postgresql://postgres:owner@localhost:5432/market", roleName: "market_catalog", password })).username, "market_catalog");
});
