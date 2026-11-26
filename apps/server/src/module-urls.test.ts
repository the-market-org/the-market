import assert from "node:assert/strict";
import { test } from "node:test";
import { selectModuleUrl } from "./compose-modules.ts";

test("a module uses its own role's connection when one is set, and the shared one otherwise", () => {
  const environment = { CATALOG_DATABASE_URL: "postgresql://market_catalog:p@db.example/postgres", ORDERS_DATABASE_URL: "" };
  assert.equal(selectModuleUrl({ schemaName: "catalog", environment, fallback: "postgresql://owner@db.example/postgres" }), "postgresql://market_catalog:p@db.example/postgres");
  assert.equal(selectModuleUrl({ schemaName: "orders", environment, fallback: "shared" }), "shared", "an empty setting falls back");
  assert.equal(selectModuleUrl({ schemaName: "pages", environment, fallback: "shared" }), "shared");
});
