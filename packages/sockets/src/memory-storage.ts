/** File storage kept in memory: for tests, and for running with no disk. */
import { checkFileNames } from "./file-keys.ts";
import type { FileStorage, StoredFile } from "./socket-types.ts";

export function buildMemoryStorage(): FileStorage {
  const stored = new Map<string, StoredFile>();
  const keyOf = (names: { tenantId: string; fileKey: string }) => {
    checkFileNames(names);
    return `${names.tenantId}/${names.fileKey}`;
  };
  return {
    putFile: async (file) => void stored.set(keyOf(file), { contentType: file.contentType, bytes: new Uint8Array(file.bytes) }),
    getFile: async (names) => stored.get(keyOf(names)),
    deleteFile: async (names) => void stored.delete(keyOf(names)),
  };
}
