import assert from "node:assert/strict";
import { test } from "node:test";
import { applyHostName, localEndpoint, readAgentArguments } from "./agent-arguments.ts";

test("the store, host and wait are read from the arguments, the token from the environment", () => {
  assert.deepEqual(readAgentArguments({ argv: ["--store", "http://localhost:3000", "--host", "localhost", "--wait", "30"], environment: { AGENT_TOKEN: "token" } }), {
    storeUrl: "http://localhost:3000",
    hostHeader: "localhost",
    waitPolls: 30,
    agentToken: "token",
  });
});

test("wait defaults to none and the host to the store's own", () => {
  const options = readAgentArguments({ argv: ["--store", "https://shop-a.example"], environment: { AGENT_TOKEN: "token" } });
  assert.deepEqual([options.waitPolls, options.hostHeader], [0, ""]);
});

test("missing token or store stops with a message saying what to set", () => {
  assert.throws(() => readAgentArguments({ argv: ["--store", "http://localhost:3000"], environment: {} }), { message: "Set AGENT_TOKEN to an agent token for the store" });
  assert.throws(() => readAgentArguments({ argv: [], environment: { AGENT_TOKEN: "token" } }), { message: "Pass --store <store address>, for example --store http://localhost:3000" });
});

test("the card's A2A path is used on the store's own address, so local runs work", () => {
  assert.equal(localEndpoint({ interfaceUrl: "https://localhost/a2a", storeUrl: "http://localhost:3000" }), "http://localhost:3000/a2a");
});

test("--host becomes the address's host name, keeping the scheme and port", () => {
  assert.equal(applyHostName({ storeUrl: "http://localhost:3944", hostName: "shop-s.localhost" }), "http://shop-s.localhost:3944");
  assert.equal(applyHostName({ storeUrl: "http://localhost:3944", hostName: "" }), "http://localhost:3944");
});
