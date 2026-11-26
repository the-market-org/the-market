import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { test } from "node:test";
import { buildKeySetIdentity, readKeySet } from "./key-set-identity.ts";
import { buildTokenIdentity } from "./token-identity.ts";

const NOW_MILLISECONDS = 1_800_000_000_000;
const CLAIMS = { sub: "user-1", exp: NOW_MILLISECONDS / 1000 + 60, app_metadata: { tenant_id: "tenant-a", role: "merchant" } };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

function buildSigner(kid: string) {
  const pair = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicKey = { ...pair.publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" };
  const signToken = (claims: unknown, header: Record<string, unknown> = { alg: "ES256", kid, typ: "JWT" }) => {
    const signingInput = `${encode(header)}.${encode(claims)}`;
    return `${signingInput}.${sign("sha256", Buffer.from(signingInput), { key: pair.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
  };
  return { publicKey, signToken };
}

function buildIdentity(input: { keys: unknown[]; now?: () => number }) {
  const loads: string[] = [];
  const identity = buildKeySetIdentity({
    keysUrl: "https://project.example/auth/v1/.well-known/jwks.json",
    loadJson: async (url) => (loads.push(url), { keys: input.keys }),
    fallback: buildTokenIdentity({ secret: "test-identity-secret", readNow: () => NOW_MILLISECONDS }),
    readNow: input.now ?? (() => NOW_MILLISECONDS),
  });
  return { loads, verify: (token: string) => identity.verifyToken({ token }) };
}

test("an ES256 token signed by a published key gives the subject, tenant and role", async () => {
  const signer = buildSigner("key-1");
  const identity = buildIdentity({ keys: [signer.publicKey] });
  assert.deepEqual(await identity.verify(signer.signToken(CLAIMS)), { subject: "user-1", tenantId: "tenant-a", role: "merchant" });
  assert.deepEqual(identity.loads, ["https://project.example/auth/v1/.well-known/jwks.json"]);
});

test("ES256 tokens that must not pass are refused", async () => {
  const signer = buildSigner("key-1");
  const stranger = buildSigner("key-1");
  const identity = buildIdentity({ keys: [signer.publicKey] });
  const [header = "", , signature = ""] = signer.signToken(CLAIMS).split(".");
  const refused = [
    stranger.signToken(CLAIMS),
    `${header}.${encode({ ...CLAIMS, app_metadata: { tenant_id: "tenant-b" } })}.${signature}`,
    signer.signToken({ ...CLAIMS, exp: NOW_MILLISECONDS / 1000 - 1 }),
    signer.signToken(CLAIMS, { alg: "ES256", kid: "key-unknown" }),
  ];
  for (const token of refused) assert.equal(await identity.verify(token), undefined);
});

test("an unknown kid reloads the key set at most once a minute, so rotated keys are found", async () => {
  const rotated = buildSigner("key-2");
  const keys: unknown[] = [];
  let now = NOW_MILLISECONDS;
  const identity = buildIdentity({ keys, now: () => now });
  const token = rotated.signToken({ ...CLAIMS, exp: NOW_MILLISECONDS / 1000 + 3600 });
  assert.equal(await identity.verify(token), undefined);
  keys.push(rotated.publicKey);
  assert.equal(await identity.verify(token), undefined);
  assert.equal(identity.loads.length, 1);
  now += 60_000;
  assert.equal((await identity.verify(token))?.tenantId, "tenant-a");
  assert.equal(identity.loads.length, 2);
});

test("HS256 tokens still go to the secret, and other algorithms are refused", async () => {
  const identity = buildIdentity({ keys: [buildSigner("key-1").publicKey] });
  const signingInput = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(CLAIMS)}`;
  const secretToken = `${signingInput}.${createHmac("sha256", "test-identity-secret").update(signingInput).digest("base64url")}`;
  assert.equal((await identity.verify(secretToken))?.subject, "user-1");
  assert.equal(await identity.verify(`${encode({ alg: "none" })}.${encode(CLAIMS)}.`), undefined);
  assert.equal(identity.loads.length, 0);
});

test("only P-256 keys are read from the key set", () => {
  assert.deepEqual(readKeySet({ keys: [{ kty: "RSA", kid: "rsa" }, { kty: "EC", crv: "P-384", kid: "p384" }, { kty: "EC", crv: "P-256", kid: "p256" }] }).map((key) => key.kid), ["p256"]);
  assert.deepEqual(readKeySet("not a key set"), []);
});
