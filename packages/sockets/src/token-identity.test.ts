import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { buildTokenIdentity } from "./token-identity.ts";

const NOW_MILLISECONDS = 1_800_000_000_000;
const SECRET = "test-secret-for-unit-tests";

function encode(value: unknown): string {
  return Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
}

/** Builds a token the way an HS256 issuer would, so the verifier is tested against real signatures. */
function signTestToken(input: { payload: unknown; secret?: string; header?: unknown }): string {
  const signingInput = `${encode(input.header ?? { alg: "HS256", typ: "JWT" })}.${encode(input.payload)}`;
  const signature = createHmac("sha256", input.secret ?? SECRET).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

const goodClaims = { sub: "user-1", exp: NOW_MILLISECONDS / 1000 + 60, app_metadata: { tenant_id: "tenant-a", role: "owner" } };

function verify(token: string, secret = SECRET) {
  return buildTokenIdentity({ secret, readNow: () => NOW_MILLISECONDS }).verifyToken({ token });
}

test("a valid token gives the subject, tenant and role", async () => {
  assert.deepEqual(await verify(signTestToken({ payload: goodClaims })), { subject: "user-1", tenantId: "tenant-a", role: "owner" });
});

test("the role defaults to merchant", async () => {
  const claims = { ...goodClaims, app_metadata: { tenant_id: "tenant-a" } };
  assert.equal((await verify(signTestToken({ payload: claims })))?.role, "merchant");
});

test("tokens that must not pass are refused", async () => {
  const refused = [
    signTestToken({ payload: goodClaims, secret: "another-secret" }),
    signTestToken({ payload: { ...goodClaims, exp: NOW_MILLISECONDS / 1000 - 1 } }),
    signTestToken({ payload: { ...goodClaims, exp: "never" } }),
    signTestToken({ payload: goodClaims, header: { alg: "none" } }),
    signTestToken({ payload: goodClaims, header: { alg: "HS512" } }),
    signTestToken({ payload: goodClaims }).split(".").slice(0, 2).join("."),
    `${signTestToken({ payload: goodClaims })}.extra`,
    signTestToken({ payload: "not json" }),
    signTestToken({ payload: { ...goodClaims, app_metadata: {} } }),
    signTestToken({ payload: { ...goodClaims, sub: "" } }),
    "",
  ];
  for (const token of refused) {
    assert.equal(await verify(token), undefined, token);
  }
});

test("with no secret configured, every token is refused", async () => {
  assert.equal(await verify(signTestToken({ payload: goodClaims, secret: "" }), ""), undefined);
});
