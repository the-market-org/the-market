import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { composeSockets } from "./compose-sockets.ts";

const NOW_MILLISECONDS = 1_800_000_000_000;
const files = { writeFile, readFile, rm, mkdir };

function signToken(secret: string): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claims = { sub: "user-1", exp: NOW_MILLISECONDS / 1000 + 60, app_metadata: { tenant_id: "tenant-a" } };
  const signingInput = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}`;
  return `${signingInput}.${createHmac("sha256", secret).update(signingInput).digest("base64url")}`;
}

function compose(environment: Record<string, string | undefined>) {
  return composeSockets({ environment, readNow: () => NOW_MILLISECONDS, writeLine: () => {}, files });
}

test("with an empty environment, identity is off and refuses even a well-signed token", async () => {
  const sockets = compose({});
  assert.equal(sockets.identityEnabled, false);
  assert.equal(await sockets.identity.verifyToken({ token: signToken("anything") }), undefined);
});

test("IDENTITY_SECRET turns identity on", async () => {
  const sockets = compose({ IDENTITY_SECRET: "test-identity-secret" });
  assert.equal(sockets.identityEnabled, true);
  assert.equal((await sockets.identity.verifyToken({ token: signToken("test-identity-secret") }))?.tenantId, "tenant-a");
});

test("files stay in memory without FILES_FOLDER and land in the folder with it", async () => {
  const inMemory = compose({}).storage;
  await inMemory.putFile({ tenantId: "tenant-a", fileKey: "logo.png", contentType: "image/png", bytes: new Uint8Array([1]) });
  assert.equal((await inMemory.getFile({ tenantId: "tenant-a", fileKey: "logo.png" }))?.contentType, "image/png");

  const folder = await mkdtemp(join(tmpdir(), "compose-sockets-"));
  await compose({ FILES_FOLDER: folder }).storage.putFile({ tenantId: "tenant-a", fileKey: "logo.png", contentType: "image/png", bytes: new Uint8Array([1]) });
  assert.deepEqual(await readdir(join(folder, "tenant-a")), ["logo.png", "logo.png.type"]);
});

test("mail and app authorisation use the defaults", async () => {
  const sockets = compose({});
  await sockets.mail.sendMail({ tenantId: "tenant-a", toAddress: "ruth@example.com", subject: "Hello", textBody: "" });
  assert.equal(await sockets.authoriser.decideApp({ tenantId: "tenant-a", appUrl: "https://app.example", permissions: [] }), "pending");
});
