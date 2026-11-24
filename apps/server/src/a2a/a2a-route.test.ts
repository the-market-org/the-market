import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";

const changeSet = { changeSetId: "set_1", tenantId: "tenant-a", state: "draft", items: [] };
const registry = {
  tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a" })[request.host], findTenant: async () => ({ name: "Leads & Co" }) },
  catalog: { listProducts: async () => [] },
  pages: { findPage: async () => undefined },
  changes: {
    createChangeSet: async () => changeSet,
    findChangeSet: async (keys: { tenantId: string; changeSetId: string }) => (keys.tenantId === "tenant-a" && keys.changeSetId === "set_1" ? changeSet : undefined),
    addChangeItem: async () => ({}),
    moveChangeSet: async () => {},
  },
};
const identity = { verifyToken: async (request: { token: string }) => (request.token === "agent-a" ? { subject: "agent-1", tenantId: "tenant-a", role: "agent" } : undefined) };

async function buildApp() {
  return composeServer({ readUptime: () => 0, registry, capabilities: {}, merchantToken: "", identity, identityEnabled: true });
}

test("each store publishes an agent card naming its own A2A endpoint and the approval skill", async () => {
  const response = await (await buildApp()).request("/.well-known/agent-card.json", { headers: { host: "shop-a.example" } });
  const card = (await response.json()) as Record<string, any>;
  assert.equal(response.status, 200);
  assert.equal(card.name, "Leads & Co");
  assert.deepEqual(card.supportedInterfaces, [{ url: "https://shop-a.example/a2a", protocolBinding: "JSONRPC", protocolVersion: "1.0" }]);
  assert.deepEqual(card.skills.map((skill: { id: string }) => skill.id), ["change-set-approval"]);
  assert.deepEqual(card.securitySchemes, { bearer: { httpAuthSecurityScheme: { scheme: "Bearer", bearerFormat: "JWT" } } });
  for (const field of ["description", "version", "capabilities", "defaultInputModes", "defaultOutputModes"]) {
    assert.ok(field in card, field);
  }
});

test("the store's agent can open an approval task; anyone else gets 401", async () => {
  const app = await buildApp();
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: { messageId: "m1", role: "ROLE_USER", parts: [{ data: { changeSetId: "set_1" } }] } } });
  const send = (token: string) => app.request("/a2a", { method: "POST", headers: { host: "shop-a.example", authorization: `Bearer ${token}`, "content-type": "application/json" }, body });

  const reply = await send("agent-a");
  assert.equal(reply.status, 200);
  assert.equal(((await reply.json()) as Record<string, any>).result.task.status.state, "TASK_STATE_INPUT_REQUIRED");
  assert.equal((await send("someone-else")).status, 401);
});
