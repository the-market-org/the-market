/**
 * Identity over a published key set (JWKS), for issuers that sign with ES256, such as Supabase Auth's
 * signing keys. Tokens marked ES256 are checked against the key named by their `kid`; every other
 * token goes to the fallback socket (the HS256 secret), so tokens signed with IDENTITY_SECRET keep working.
 */
import { createPublicKey, verify } from "node:crypto";
import type { JsonWebKey } from "node:crypto";
import type { Identity, IdentitySocket } from "./socket-types.ts";
import { asRecord, decodeSegment, readIdentity, readText } from "./token-identity.ts";

/** How long a loaded key set is trusted before an unknown `kid` may load it again. */
export const KEY_SET_RELOAD_MILLISECONDS = 60_000;

/** The P-256 public keys of a JWKS document. */
export function readKeySet(document: unknown): JsonWebKey[] {
  const keys = asRecord(document).keys;
  return (Array.isArray(keys) ? keys : []).map(asRecord).filter((key) => key.kty === "EC" && key.crv === "P-256") as JsonWebKey[];
}

/** True only when the ES256 signature over the signing input matches the key. */
export function isEs256SignatureValid(input: { signingInput: string; signature: string; key: JsonWebKey }): boolean {
  try {
    const publicKey = createPublicKey({ key: input.key, format: "jwk" });
    return verify("sha256", Buffer.from(input.signingInput), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(input.signature, "base64url"));
  } catch {
    return false;
  }
}

/** A key finder that loads the key set once, and again for an unknown `kid` at most once a minute. */
export function buildKeyFinder(input: { loadKeys: () => Promise<JsonWebKey[]>; readNow: () => number }): (kid: string) => Promise<JsonWebKey | undefined> {
  const cache = { keys: [] as JsonWebKey[], loadedAt: Number.NEGATIVE_INFINITY };
  const pick = (kid: string) => cache.keys.find((key) => key.kid === kid);
  return async (kid) => {
    if (pick(kid) !== undefined || input.readNow() - cache.loadedAt < KEY_SET_RELOAD_MILLISECONDS) return pick(kid);
    Object.assign(cache, { keys: await input.loadKeys().catch(() => cache.keys), loadedAt: input.readNow() });
    return pick(kid);
  };
}

export interface KeySetSteps {
  findKey: (kid: string) => Promise<JsonWebKey | undefined>;
  checkSignature: typeof isEs256SignatureValid;
  readClaims: (input: { claims: Record<string, unknown>; nowSeconds: number }) => Identity | undefined;
  fallback: IdentitySocket;
}

/** Verifies an ES256 token against the published keys, or hands any other token to the fallback. */
export async function verifyKeySetToken(input: { token: string; nowSeconds: number; steps: KeySetSteps }): Promise<Identity | undefined> {
  const parts = input.token.split(".");
  const [headerPart = "", claimsPart = "", signature = ""] = parts;
  const header = asRecord(decodeSegment(headerPart));
  if (header.alg !== "ES256") return input.steps.fallback.verifyToken({ token: input.token });
  const key = await input.steps.findKey(readText(header.kid));
  const valid = parts.length === 3 && key !== undefined && input.steps.checkSignature({ signingInput: `${headerPart}.${claimsPart}`, signature, key });
  return valid ? input.steps.readClaims({ claims: asRecord(decodeSegment(claimsPart)), nowSeconds: input.nowSeconds }) : undefined;
}

/** Composition: ES256 against the key set at `keysUrl`, everything else through the fallback. */
export function buildKeySetIdentity(input: { keysUrl: string; loadJson: (url: string) => Promise<unknown>; fallback: IdentitySocket; readNow: () => number }): IdentitySocket {
  const steps: KeySetSteps = {
    findKey: buildKeyFinder({ loadKeys: async () => readKeySet(await input.loadJson(input.keysUrl)), readNow: input.readNow }),
    checkSignature: isEs256SignatureValid,
    readClaims: (request) => readIdentity({ ...request, toRecord: asRecord, toText: readText }),
    fallback: input.fallback,
  };
  return { verifyToken: (request) => verifyKeySetToken({ token: request.token, nowSeconds: Math.floor(input.readNow() / 1000), steps }) };
}
