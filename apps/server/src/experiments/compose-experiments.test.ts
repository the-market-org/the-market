import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";
import { adoptExperiment } from "./compose-experiments.ts";

const decided = (decision: string, state = "decided") => ({ experimentId: "exp_1", variantChangeSetId: "set_variant", state, outcome: { decision } });

test("adopting applies the variant change set of an adopt or unclear outcome, and nothing else", async () => {
  for (const [experiment, expected] of [[decided("adopt"), "set_variant"], [decided("unclear"), "set_variant"], [decided("discard"), ""], [decided("", "running"), ""]] as const) {
    const applied: string[] = [];
    const adopting = adoptExperiment({
      tenantId: "tenant-a",
      experimentId: "exp_1",
      findExperiment: async () => experiment,
      applyVariant: async (keys) => void applied.push(keys.changeSetId),
      markAdopted: async () => 1,
    });
    const outcome = await adopting.then((adopted) => adopted.state).catch((error: Error) => error.message);
    assert.equal(outcome, expected === "" ? "Only an adopt or unclear outcome can be adopted" : "adopted");
    assert.deepEqual(applied, expected === "" ? [] : [expected]);
  }
});

const registry = {
  tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[request.host], findTenant: async () => ({ name: "Shop" }) },
  catalog: { listProducts: async () => [] },
  pages: { findPage: async () => undefined },
  changes: { createChangeSet: async () => ({}), findChangeSet: async () => undefined, addChangeItem: async () => ({}), moveChangeSet: async () => {} },
  connections: { saveConnection: async () => ({ signingSecret: "" }), findConnection: async () => undefined, removeConnection: async () => {} },
  experiments: {
    listExperiments: async (query: { tenantId: string }) => (query.tenantId === "tenant-a" ? [decided("adopt")] : []),
    findExperiment: async (keys: { tenantId: string }) => (keys.tenantId === "tenant-a" ? decided("discard") : Promise.reject(new Error("Experiment not found"))),
    measureExperiment: async () => ({ goal: {}, guardrail: {} }),
    decideExperiment: async (request: { now: string }) => Promise.reject(new Error(request.now < "2100-01-01" ? "Experiment is still running" : "unexpected")),
  },
};

async function send(input: { method?: string; path: string; host?: string; token?: string }) {
  const app = await composeServer({ readUptime: () => 0, registry, capabilities: {}, merchantToken: "secret", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  const response = await app.request(input.path, { method: input.method ?? "GET", headers: { host: input.host ?? "shop-a.example", authorization: `Bearer ${input.token ?? "secret"}` } });
  return { status: response.status, body: await response.json() };
}

test("experiment routes answer per store, and refusals map to their statuses", async () => {
  assert.equal((await send({ path: "/api/experiments" })).body.experiments.length, 1);
  assert.deepEqual((await send({ path: "/api/experiments", host: "shop-b.example" })).body, { experiments: [] });
  assert.deepEqual(await send({ path: "/api/experiments/exp_1", host: "shop-b.example" }), { status: 404, body: { error: "Experiment not found" } });
  assert.equal((await send({ method: "POST", path: "/api/experiments/exp_1/decide" })).status, 409);
  assert.deepEqual(await send({ method: "POST", path: "/api/experiments/exp_1/adopt" }), { status: 409, body: { error: "Only an adopt or unclear outcome can be adopted" } });
  assert.equal((await send({ path: "/api/experiments", token: "wrong" })).status, 401);
});
