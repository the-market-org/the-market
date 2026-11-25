import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAppAddress, isPrivateAddress } from "./app-address.ts";

const lookups: Record<string, string[]> = {
  "reviews.example": ["93.184.216.34"],
  "inside.example": ["10.0.0.7"],
  "mixed.example": ["93.184.216.34", "192.168.1.20"],
  "six.example": ["fd00::1"],
};
const lookupAddress = async (host: string) => lookups[host] ?? [];

function check(baseUrl: string, allowLocalHttp = false) {
  return checkAppAddress({ baseUrl, allowLocalHttp, lookupAddress, isPrivate: isPrivateAddress });
}

test("loopback, private, link-local, shared and unique-local addresses are private", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:10.0.0.7"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress("93.184.216.34"), false);
  assert.equal(isPrivateAddress("2606:2800:220:1::1"), false);
});

test("a public https address is accepted", async () => {
  await check("https://reviews.example");
});

test("anything that could reach the store's own network is refused in production", async () => {
  for (const baseUrl of ["http://reviews.example", "https://inside.example", "https://mixed.example", "https://six.example", "https://10.0.0.7", "https://nowhere.example", "ftp://reviews.example", "not a url"]) {
    await assert.rejects(check(baseUrl), { message: "Invalid input: baseUrl must be a public https address" }, baseUrl);
  }
});

test("plain http to this machine is allowed only outside production", async () => {
  await check("http://localhost:4200", true);
  await check("http://127.0.0.1:4200", true);
  await assert.rejects(check("http://localhost:4200", false));
  await assert.rejects(check("http://reviews.example", true));
});
