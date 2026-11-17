/**
 * Default file storage: one local folder per tenant.
 * Layout: <rootFolder>/<tenantId>/<fileKey>, with the content type in <fileKey>.type.
 */
import { join } from "node:path";
import { checkFileNames } from "./file-keys.ts";
import type { FileStorage, StoredFile } from "./socket-types.ts";

/** The node:fs/promises functions the storage uses, passed in. */
export interface FolderFiles {
  writeFile: (path: string, bytes: Uint8Array | string) => Promise<void>;
  readFile: (path: string) => Promise<Uint8Array>;
  rm: (path: string, options: { force: boolean }) => Promise<void>;
  mkdir: (path: string, options: { recursive: boolean }) => Promise<unknown>;
}

/** Reads a stored file, or undefined when it does not exist. */
export async function readStoredFile(input: { filePath: string; files: FolderFiles }): Promise<StoredFile | undefined> {
  try {
    const [bytes, contentType] = await Promise.all([input.files.readFile(input.filePath), input.files.readFile(`${input.filePath}.type`)]);
    return { contentType: Buffer.from(contentType).toString("utf8"), bytes: new Uint8Array(bytes) };
  } catch {
    return undefined;
  }
}

export function buildFolderStorage(input: { rootFolder: string; files: FolderFiles }): FileStorage {
  const { files } = input;
  const pathOf = (names: { tenantId: string; fileKey: string }) => {
    checkFileNames(names);
    return join(input.rootFolder, names.tenantId, names.fileKey);
  };
  return {
    putFile: async (file) => {
      const filePath = pathOf(file);
      await files.mkdir(join(input.rootFolder, file.tenantId), { recursive: true });
      await files.writeFile(filePath, file.bytes);
      await files.writeFile(`${filePath}.type`, file.contentType);
    },
    getFile: async (names) => readStoredFile({ filePath: pathOf(names), files }),
    deleteFile: async (names) => {
      const filePath = pathOf(names);
      await Promise.all([files.rm(filePath, { force: true }), files.rm(`${filePath}.type`, { force: true })]);
    },
  };
}
