import assert from "node:assert/strict";
import { test } from "node:test";
import { TRANSACTION_LIMITS, runAsTenant, runWithSettings } from "./tenant-scope.ts";

function buildFakeClient() {
  const calls: Array<{ statement: string; values: unknown[] } | { options: unknown }> = [];
  const transaction = {
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ statement: strings.join("?"), values });
      return 1;
    },
  };
  const client = {
    $transaction: async (work: (inner: typeof transaction) => Promise<unknown>, options: unknown) => {
      calls.push({ options });
      return work(transaction);
    },
  };
  return { calls, client };
}

test("a transaction gets time to start on a slow connection: 10 seconds to start, 15 to finish", async () => {
  const fake = buildFakeClient();
  await runWithSettings({ client: fake.client, settings: {}, work: async () => "done" });
  assert.deepEqual(fake.calls[0], { options: { maxWait: 10_000, timeout: 15_000 } });
  assert.ok(TRANSACTION_LIMITS.maxWait > 2_000 && TRANSACTION_LIMITS.timeout > 5_000);
});

test("the settings are applied, in order, before the work runs", async () => {
  const fake = buildFakeClient();
  const order: string[] = [];
  const result = await runWithSettings({
    client: fake.client,
    settings: { "app.host": "shop-h.localhost", "app.slug": "shop-h" },
    work: async () => (order.push(`work after ${fake.calls.length - 1} settings`), "done"),
  });
  assert.equal(result, "done");
  assert.deepEqual(fake.calls.slice(1).map((call) => ("values" in call ? call.values : [])), [["app.host", "shop-h.localhost"], ["app.slug", "shop-h"]]);
  assert.deepEqual(order, ["work after 2 settings"]);
});

test("runAsTenant sets app.tenant_id", async () => {
  const fake = buildFakeClient();
  await runAsTenant({ client: fake.client, tenantId: "tenant-h", work: async () => undefined });
  assert.deepEqual("values" in fake.calls[1]! ? fake.calls[1].values : [], ["app.tenant_id", "tenant-h"]);
});
