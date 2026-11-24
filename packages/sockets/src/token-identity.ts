/**
 * Default identity socket: verifies HS256-signed tokens with node:crypto.
 * The tenant comes from the `app_metadata.tenant_id` claim; the role from `app_metadata.role`.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Identity, IdentitySocket } from "./socket-types.ts";

/** A plain object, or an empty one for anything else. */
export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** A string claim, or "" for anything else. */
export function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Decodes one base64url JSON segment; undefined when it is not JSON. */
export function decodeSegment(segment: string): unknown {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

export function signSegments(input: { signingInput: string; secret: string }): string {
  return createHmac("sha256", input.secret).update(input.signingInput).digest("base64url");
}

/** True only for HS256, a configured secret and a matching signature, compared in constant time. */
export function isSignatureValid(input: {
  algorithm: string;
  signingInput: string;
  signature: string;
  secret: string;
  sign: typeof signSegments;
}): boolean {
  const expected = Buffer.from(input.sign({ signingInput: input.signingInput, secret: input.secret }));
  const given = Buffer.from(input.signature);
  const sameBytes = given.length === expected.length && timingSafeEqual(given, expected);
  return input.algorithm === "HS256" && input.secret !== "" && sameBytes;
}

/** Reads who the token is for; undefined when it has expired or lacks a subject or tenant. */
export function readIdentity(input: {
  claims: Record<string, unknown>;
  nowSeconds: number;
  toRecord: typeof asRecord;
  toText: typeof readText;
}): Identity | undefined {
  const appMetadata = input.toRecord(input.claims.app_metadata);
  const identity = {
    subject: input.toText(input.claims.sub),
    tenantId: input.toText(appMetadata.tenant_id),
    role: input.toText(appMetadata.role) || "merchant",
  };
  const expiry = input.claims.exp;
  const usable = typeof expiry === "number" && expiry > input.nowSeconds && identity.subject !== "" && identity.tenantId !== "";
  return usable ? identity : undefined;
}

/** The steps a verification uses, passed in by the composition. */
export interface VerifySteps {
  decode: typeof decodeSegment;
  toRecord: typeof asRecord;
  toText: typeof readText;
  checkSignature: (input: { algorithm: string; signingInput: string; signature: string; secret: string }) => boolean;
  readClaims: (input: { claims: Record<string, unknown>; nowSeconds: number }) => Identity | undefined;
}

/** Verifies a token as three base64url parts: header, claims, signature. */
export function verifySignedToken(input: { token: string; secret: string; nowSeconds: number; steps: VerifySteps }): Identity | undefined {
  const { steps } = input;
  const parts = input.token.split(".");
  const [headerPart = "", claimsPart = "", signature = ""] = parts;
  const signingInput = `${headerPart}.${claimsPart}`;
  const algorithm = steps.toText(steps.toRecord(steps.decode(headerPart)).alg);
  const valid = parts.length === 3 && steps.checkSignature({ algorithm, signingInput, signature, secret: input.secret });
  return valid ? steps.readClaims({ claims: steps.toRecord(steps.decode(claimsPart)), nowSeconds: input.nowSeconds }) : undefined;
}

/** Composition: the identity socket over one shared secret and a clock in milliseconds. */
export function buildTokenIdentity(input: { secret: string; readNow: () => number }): IdentitySocket {
  const steps: VerifySteps = {
    decode: decodeSegment,
    toRecord: asRecord,
    toText: readText,
    checkSignature: (request) => isSignatureValid({ ...request, sign: signSegments }),
    readClaims: (request) => readIdentity({ ...request, toRecord: asRecord, toText: readText }),
  };
  return {
    verifyToken: async (request) =>
      verifySignedToken({ token: request.token, secret: input.secret, nowSeconds: Math.floor(input.readNow() / 1000), steps }),
  };
}
