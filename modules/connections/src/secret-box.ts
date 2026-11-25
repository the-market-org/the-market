/**
 * Seals signing secrets for storage with AES-256-GCM. A sealed value is `v1:<iv>:<tag>:<ciphertext>`,
 * each part base64url. A value without the `v1:` prefix is a secret stored before sealing existed.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "v1:";
const KEY_BYTES = 32;

/** The 32-byte key from its base64 setting, or a clear refusal. */
export function readSecretsKey(setting: string): Buffer {
  const key = Buffer.from(setting, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error("SECRETS_KEY must be 32 bytes, base64 encoded");
  }
  return key;
}

export function sealSecret(input: { plain: string; key: Buffer }): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", input.key, iv);
  const ciphertext = Buffer.concat([cipher.update(input.plain, "utf8"), cipher.final()]);
  return `${PREFIX}${[iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(":")}`;
}

export function isSealed(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

/** The plain secret; a wrong key or a changed value fails the GCM check and throws. */
export function openSecret(input: { stored: string; key: Buffer }): string {
  const [iv, tag, ciphertext] = input.stored.slice(PREFIX.length).split(":").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", input.key, iv as Buffer);
  decipher.setAuthTag(tag as Buffer);
  return Buffer.concat([decipher.update(ciphertext as Buffer), decipher.final()]).toString("utf8");
}

/** Reads a stored secret: sealed ones need the key, older plain ones are returned as they are. */
export function readStoredSecret(input: { stored: string; key: Buffer | undefined; open: typeof openSecret }): string {
  if (!isSealed(input.stored)) {
    return input.stored;
  }
  if (input.key === undefined) {
    throw new Error("SECRETS_KEY is needed to read the agent connection's signing secret");
  }
  return input.open({ stored: input.stored, key: input.key });
}
