import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseActions, createRandom, keepCookies, simulateVisitor } from "./simulate-visitors.ts";

test("the same seed gives the same draws, and add rates follow the marker", () => {
  const first = createRandom(7);
  const second = createRandom(7);
  assert.deepEqual([first(), first()], [second(), second()]);
  const random = createRandom(11);
  const addShare = (seesMarker: boolean) => Array.from({ length: 4000 }, () => chooseActions({ seesMarker, addDraw: random(), payDraw: random() }).adds).filter(Boolean).length / 4000;
  assert.ok(Math.abs(addShare(true) - 0.25) < 0.03 && Math.abs(addShare(false) - 0.05) < 0.02);
  assert.deepEqual(chooseActions({ seesMarker: true, addDraw: 0.9, payDraw: 0 }), { adds: false, pays: false }, "only carts are paid for");
});

test("cookies keep the newest value per name and drop cleared ones", () => {
  const cookies = keepCookies({ cookies: ["visitor_id=v1", "cart_id=c1"], setCookies: ["cart_id=; Path=/; Max-Age=0", "visitor_id=v2; Path=/"] });
  assert.deepEqual(cookies, ["visitor_id=v2"]);
});

test("a visitor who sees the marker adds and pays with the cookies the store gave them", async () => {
  const calls: string[] = [];
  const replies: Record<string, { status: number; setCookies: string[]; text: string }> = {
    "GET /products/rope-lead": { status: 200, setCookies: ["visitor_id=v1; Path=/"], text: '<input name="productId" value="p-lead">Free UK delivery' },
    "POST /cart/lines": { status: 303, setCookies: ["cart_id=c1; Path=/"], text: "" },
    "POST /cart/checkout": { status: 303, setCookies: [], text: "" },
  };
  const visit = await simulateVisitor({
    marker: "Free UK delivery",
    random: () => 0.01,
    send: async (call) => {
      calls.push(`${call.method} ${call.path} [${call.cookies.join("; ")}] ${call.body}`);
      return replies[`${call.method} ${call.path}`] ?? { status: 404, setCookies: [], text: "" };
    },
  });
  assert.deepEqual(visit, { seesMarker: true, adds: true, pays: true });
  assert.deepEqual(calls, ["GET /products/rope-lead [] ", "POST /cart/lines [visitor_id=v1] productId=p-lead&quantity=1", "POST /cart/checkout [visitor_id=v1; cart_id=c1] "]);
});
