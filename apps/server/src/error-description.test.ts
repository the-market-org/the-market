import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "./compose.ts";
import { describeForCaller, isInternalError } from "./error-description.ts";

class PrismaClientKnownRequestError extends Error {
  override name = "PrismaClientKnownRequestError";
}

test("domain messages pass through; database, programming and non-errors become a logged reference", () => {
  const logged: string[] = [];
  const describe = (error: unknown) => describeForCaller({ error, isInternal: isInternalError, createReference: () => "ref-1", log: (line) => logged.push(line) });
  assert.equal(describe(new Error("Change set not found")), "Change set not found");
  const leak = new PrismaClientKnownRequestError("Invalid `prisma.app.findMany()` invocation: Unknown argument `decision`");
  for (const error of [leak, new TypeError("cannot read properties of undefined"), "a thrown string"]) {
    assert.equal(describe(error), "Something went wrong (reference ref-1)");
  }
  assert.equal(logged.length, 3);
  assert.match(String(logged[0]), /^internal error ref-1: PrismaClientKnownRequestError: Invalid `prisma\.app\.findMany\(\)`/);
});

test("a route whose service fails inside the database answers 500 without the database's text", async () => {
  const registry = {
    tenancy: { resolveTenant: async () => "tenant-a", findTenant: async () => ({ name: "Shop" }) },
    catalog: { listProducts: async () => [] },
    pages: { findPage: async () => undefined },
    changes: { createChangeSet: async () => ({}), findChangeSet: async () => Promise.reject(new PrismaClientKnownRequestError("Invalid `prisma.changeSet.findMany()` SELECT secret_column")), addChangeItem: async () => ({}), moveChangeSet: async () => {} },
    connections: { saveConnection: async () => ({ signingSecret: "" }), findConnection: async () => undefined, removeConnection: async () => {} },
  };
  const app = await composeServer({ readUptime: () => 0, registry, capabilities: {}, merchantToken: "secret", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  const response = await app.request("/api/change-sets/set_1", { headers: { host: "shop-a.example", authorization: "Bearer secret" } });
  const bodyText = await response.text();
  assert.equal(response.status, 500);
  assert.match(bodyText, /^\{"error":"Something went wrong \(reference [0-9a-f-]{36}\)"\}$/);
  assert.doesNotMatch(bodyText, /prisma|secret_column/i);
});
