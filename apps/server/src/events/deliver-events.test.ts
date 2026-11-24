import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { deliverEvent, findWantedTarget, readEventTenant, signEventBody } from "./deliver-events.ts";
import type { PostEvent } from "./deliver-events.ts";

const targets: Record<string, { eventsUrl: string; eventNames: string[]; signingSecret: string }> = {
  "tenant-a": { eventsUrl: "https://agent.example/hook", eventNames: ["changes.change-set.moved"], signingSecret: "secret-a" },
};

function deliver(input: { eventName: string; payload: unknown; post: PostEvent; lines?: string[] }) {
  return deliverEvent({
    eventName: input.eventName,
    payload: input.payload,
    readTenant: readEventTenant,
    findTarget: (request) => findWantedTarget({ ...request, findDeliveryTarget: async (keys) => targets[keys.tenantId] }),
    post: input.post,
    sign: signEventBody,
    readNow: () => Date.UTC(2026, 10, 17, 12, 0, 0),
    writeLine: (line) => input.lines?.push(line),
  });
}

test("an event of a connected store is posted once with a signature the agent can check", async () => {
  const posts: Array<{ url: string; headers: Record<string, string>; bodyText: string }> = [];
  await deliver({ eventName: "changes.change-set.moved", payload: { tenantId: "tenant-a", changeSetId: "set_1" }, post: async (request) => void posts.push(request) });

  assert.equal(posts.length, 1);
  const [sent] = posts;
  assert.equal(sent?.url, "https://agent.example/hook");
  assert.deepEqual(JSON.parse(String(sent?.bodyText)), {
    eventName: "changes.change-set.moved",
    tenantId: "tenant-a",
    occurredAt: "2026-11-17T12:00:00.000Z",
    payload: { tenantId: "tenant-a", changeSetId: "set_1" },
  });
  const expected = `sha256=${createHmac("sha256", "secret-a").update(String(sent?.bodyText)).digest("hex")}`;
  assert.equal(sent?.headers["x-market-signature"], expected);
});

test("nothing is sent for another store, an unlisted event, or a payload without a tenant", async () => {
  const posts: unknown[] = [];
  const post: PostEvent = async (request) => void posts.push(request);
  await deliver({ eventName: "changes.change-set.moved", payload: { tenantId: "tenant-b" }, post });
  await deliver({ eventName: "catalog.product.created", payload: { tenantId: "tenant-a" }, post });
  await deliver({ eventName: "changes.change-set.moved", payload: "no tenant", post });
  assert.deepEqual(posts, []);
});

test("a failing delivery is logged and never thrown", async () => {
  const lines: string[] = [];
  await deliver({ eventName: "changes.change-set.moved", payload: { tenantId: "tenant-a" }, post: async () => Promise.reject(new Error("connection refused")), lines });
  assert.deepEqual(lines, ["Event delivery failed: changes.change-set.moved to agent.example: connection refused"]);
});
