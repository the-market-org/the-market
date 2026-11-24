import { FILE_KEY_PATTERN } from "./socket-types.ts";

/** Refuses any tenant id or file key that could act as a path. */
export function checkFileNames(input: { tenantId: string; fileKey: string }): void {
  if (!FILE_KEY_PATTERN.test(input.tenantId) || !FILE_KEY_PATTERN.test(input.fileKey)) {
    throw new Error("Invalid file key");
  }
}
