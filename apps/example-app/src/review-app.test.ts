import assert from "node:assert/strict";
import { test } from "node:test";
import { composeA2aServer } from "@the-market/a2a-gateway";
import { REVIEW_FRAGMENT, answerAppRequest, buildReviewCard, buildReviewHandlers } from "./review-app.ts";

const card = buildReviewCard({ baseUrl: "http://localhost:4200" });

function answer(input: { method: string; path: string; bodyText?: string }) {
  return answerAppRequest({ ...input, bodyText: input.bodyText ?? "", card, answerRpc: composeA2aServer(buildReviewHandlers()) });
}

test("the Agent Card offers one storefront-slot skill on a JSON-RPC interface", async () => {
  const reply = await answer({ method: "GET", path: "/.well-known/agent-card.json" });
  const served = JSON.parse(reply.bodyText);
  assert.equal(reply.status, 200);
  assert.deepEqual(served.supportedInterfaces, [{ url: "http://localhost:4200/a2a", protocolBinding: "JSONRPC", protocolVersion: "1.0" }]);
  assert.deepEqual(served.skills.map((skill: { id: string; tags: string[] }) => [skill.id, skill.tags]), [["review-stars", ["storefront-slot"]]]);
});

test("SendMessage answers with the star rating as a text part", async () => {
  const bodyText = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "SendMessage", params: { message: { messageId: "m1", role: "ROLE_USER", parts: [{ data: { skillId: "review-stars", input: { productHandle: "rope-lead" } } }] } } });
  const reply = JSON.parse((await answer({ method: "POST", path: "/a2a", bodyText })).bodyText);
  assert.equal(reply.result.message.parts[0].text, REVIEW_FRAGMENT);
  assert.equal(REVIEW_FRAGMENT, '<p class="stars">★★★★☆ 4.6 from 128 reviews</p>');
});

test("any other path is 404", async () => {
  assert.equal((await answer({ method: "GET", path: "/admin" })).status, 404);
});
