import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildFolderStorage } from "./folder-storage.ts";
import { buildMemoryStorage } from "./memory-storage.ts";
import type { FileStorage } from "./socket-types.ts";

const logo = { contentType: "image/png", bytes: new Uint8Array([137, 80, 78, 71]) };

async function buildStorages(): Promise<Array<[string, FileStorage, string]>> {
  const rootFolder = await mkdtemp(join(tmpdir(), "folder-storage-"));
  return [
    ["folder", buildFolderStorage({ rootFolder, files: { writeFile, readFile, rm, mkdir } }), rootFolder],
    ["memory", buildMemoryStorage(), ""],
  ];
}

test("a stored file comes back with its bytes and type, for its own tenant only", async () => {
  for (const [label, storage] of await buildStorages()) {
    await storage.putFile({ tenantId: "tenant-a", fileKey: "logo.png", ...logo });

    const found = await storage.getFile({ tenantId: "tenant-a", fileKey: "logo.png" });
    assert.deepEqual([found?.contentType, [...(found?.bytes ?? [])]], ["image/png", [137, 80, 78, 71]], label);
    assert.equal(await storage.getFile({ tenantId: "tenant-b", fileKey: "logo.png" }), undefined, label);
  }
});

test("keys that could be paths are refused and nothing is written", async () => {
  for (const [label, storage, rootFolder] of await buildStorages()) {
    for (const fileKey of ["../x", "a/b", ".hidden"]) {
      await assert.rejects(storage.putFile({ tenantId: "tenant-a", fileKey, ...logo }), { message: "Invalid file key" }, label);
      await assert.rejects(storage.getFile({ tenantId: "tenant-a", fileKey }), { message: "Invalid file key" }, label);
    }
    await assert.rejects(storage.putFile({ tenantId: "../tenant-b", fileKey: "logo.png", ...logo }), { message: "Invalid file key" });
    assert.deepEqual(rootFolder === "" ? [] : await readdir(rootFolder), [], label);
  }
});

test("a deleted file is gone", async () => {
  for (const [label, storage] of await buildStorages()) {
    await storage.putFile({ tenantId: "tenant-a", fileKey: "logo.png", ...logo });
    await storage.deleteFile({ tenantId: "tenant-a", fileKey: "logo.png" });
    assert.equal(await storage.getFile({ tenantId: "tenant-a", fileKey: "logo.png" }), undefined, label);
  }
});
