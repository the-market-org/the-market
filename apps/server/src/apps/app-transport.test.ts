import assert from "node:assert/strict";
import { createServer } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { isPrivateAddress } from "./app-address.ts";
import { buildCheckedLookup, checkRequestUrl, NOT_PUBLIC, sendAppRequest } from "./app-transport.ts";
import type { CheckedLookup, RequestFunction } from "./app-transport.ts";

const requestFor = (protocol: string) => (protocol === "https:" ? httpsRequest : httpRequest) as unknown as RequestFunction;
const askLookup = (lookup: CheckedLookup, all: boolean) =>
  new Promise((resolve) => lookup("reviews.example", { all }, (error, address) => resolve(error === null ? address : error.message)));

test("a name that resolves to a private address on a later lookup is refused then (DNS rebinding)", async () => {
  const answers = [[{ address: "93.184.216.34", family: 4 }], [{ address: "127.0.0.1", family: 4 }]];
  const lookup = buildCheckedLookup({ resolve: async () => answers.shift() ?? [], isPrivate: isPrivateAddress, allowPrivate: false });
  assert.equal(await askLookup(lookup, false), "93.184.216.34");
  assert.equal(await askLookup(lookup, false), NOT_PUBLIC);
  const mixed = buildCheckedLookup({ resolve: async () => [{ address: "93.184.216.34", family: 4 }, { address: "fd00::1", family: 6 }], isPrivate: isPrivateAddress, allowPrivate: false });
  assert.equal(await askLookup(mixed, true), NOT_PUBLIC, "one private address among several is enough to refuse");
});

test("only public https, or local http in development, may be requested", () => {
  const check = (address: string, allowLocalHttp = false) => {
    try {
      return checkRequestUrl({ url: new URL(address), allowLocalHttp, isPrivate: isPrivateAddress }).hostname;
    } catch (error) {
      return (error as Error).message;
    }
  };
  assert.deepEqual(
    [check("https://reviews.example/a2a"), check("https://10.0.0.5/a2a"), check("https://[::1]/a2a"), check("http://reviews.example/a2a"), check("http://localhost:4200/a2a"), check("http://localhost:4200/a2a", true)],
    ["reviews.example", NOT_PUBLIC, NOT_PUBLIC, NOT_PUBLIC, NOT_PUBLIC, "localhost"],
  );
});

test("against a real server: local development works, redirects and production refuse", async () => {
  const server = createServer((request, response) => (request.url === "/moved" ? response.writeHead(302, { location: "http://127.0.0.1/" }).end() : response.writeHead(200).end('{"ok":true}')));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const send = (path: string, allowLocalHttp: boolean) =>
    sendAppRequest({
      request: { url: `http://localhost:${port}${path}`, method: "POST", headers: { "content-type": "application/json" }, bodyText: "{}" },
      allowLocalHttp,
      isPrivate: isPrivateAddress,
      lookup: buildCheckedLookup({ resolve: async () => [{ address: "127.0.0.1", family: 4 }], isPrivate: isPrivateAddress, allowPrivate: allowLocalHttp }),
      timeoutMs: 2000,
      requestFor,
    }).then((reply) => reply.bodyText, (error: Error) => error.message);
  try {
    assert.equal(await send("/a2a", true), '{"ok":true}');
    assert.equal(await send("/moved", true), "App redirects are refused");
    assert.equal(await send("/a2a", false), NOT_PUBLIC);
  } finally {
    server.close();
  }
});
