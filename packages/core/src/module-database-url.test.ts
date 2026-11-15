import assert from "node:assert/strict";
import { test } from "node:test";
import { buildModuleDatabaseUrl } from "./module-database-url.ts";

test("adds the module schema to a URL without a query", () => {
  assert.equal(
    buildModuleDatabaseUrl({ databaseUrl: "postgresql://usr:pwd@host:5432/shop", schemaName: "catalog" }),
    "postgresql://usr:pwd@host:5432/shop?schema=catalog",
  );
});

test("keeps other parameters and replaces an existing schema", () => {
  assert.equal(
    buildModuleDatabaseUrl({
      databaseUrl: "postgresql://usr:pwd@host:5432/shop?sslmode=require&schema=public",
      schemaName: "orders",
    }),
    "postgresql://usr:pwd@host:5432/shop?sslmode=require&schema=orders",
  );
});
