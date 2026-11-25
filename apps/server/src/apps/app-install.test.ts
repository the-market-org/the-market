import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgentCard } from "@the-market/a2a-gateway";
import { installApp, readSlotSkills } from "./app-install.ts";

function buildCard(input: { rpcUrl?: string; tags?: string[] } = {}): AgentCard {
  return {
    name: "Review stars",
    description: "",
    version: "0.0.0",
    supportedInterfaces: [{ url: input.rpcUrl ?? "https://reviews.example/a2a", protocolBinding: "JSONRPC", protocolVersion: "1.0" }],
    capabilities: {},
    defaultInputModes: [],
    defaultOutputModes: [],
    skills: [{ id: "review-stars", name: "Stars", description: "", tags: input.tags ?? ["storefront-slot"] }, { id: "other", name: "Other", description: "", tags: [] }],
  };
}

function install(input: { card?: AgentCard; decision?: string; checked?: string[] }) {
  const registered: unknown[] = [];
  const checked = input.checked ?? [];
  const run = installApp({
    tenantId: "tenant-a",
    baseUrl: "https://reviews.example",
    permissions: ["read:products"],
    checkAddress: async (address) => {
      checked.push(address);
      return address.includes("inside") ? Promise.reject(new Error("Invalid input: baseUrl must be a public https address")) : undefined;
    },
    discover: async () => input.card ?? buildCard(),
    decide: async () => (input.decision ?? "pending") as "pending",
    register: async (app) => (registered.push(app), { ...app, appId: "app_1", status: "pending" }),
    readSkills: readSlotSkills,
  });
  return { run, registered, checked };
}

test("an app is read from its card, its addresses checked, the authoriser asked, then registered", async () => {
  const { run, registered, checked } = install({ decision: "pending" });
  assert.equal((await run).appId, "app_1");
  assert.deepEqual(checked, ["https://reviews.example", "https://reviews.example/a2a"]);
  assert.deepEqual(registered, [{ tenantId: "tenant-a", baseUrl: "https://reviews.example", name: "Review stars", rpcUrl: "https://reviews.example/a2a", slotSkills: ["review-stars"], permissions: ["read:products"], decision: "pending" }]);
});

test("a card whose A2A address points inside is refused, and nothing is registered", async () => {
  const { run, registered } = install({ card: buildCard({ rpcUrl: "https://inside.example/a2a" }) });
  await assert.rejects(run, { message: "Invalid input: baseUrl must be a public https address" });
  assert.deepEqual(registered, []);
});

test("an app with no storefront-slot skill is refused", async () => {
  const { run } = install({ card: buildCard({ tags: [] }) });
  await assert.rejects(run, { message: "The app offers no storefront slots" });
});
