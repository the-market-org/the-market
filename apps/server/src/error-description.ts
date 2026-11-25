/**
 * Turns anything thrown into text a caller may see. Errors written for people (plain `Error`s thrown by
 * services) keep their message. Internal errors (the database client, programming errors, non-errors)
 * become "Something went wrong" with a reference, and only the log holds their details.
 */
import { randomUUID } from "node:crypto";

const INTERNAL_ERROR_NAMES: readonly string[] = Object.freeze(["TypeError", "ReferenceError", "RangeError", "SyntaxError"]);
export const INTERNAL_MESSAGE = "Something went wrong";

/** True for errors whose text is for developers, not callers. */
export function isInternalError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  return !(error instanceof Error) || name.startsWith("PrismaClient") || INTERNAL_ERROR_NAMES.includes(name);
}

/** The caller's text: the message for domain errors; a reference, logged with the details, for internal ones. */
export function describeForCaller(input: {
  error: unknown;
  isInternal: typeof isInternalError;
  createReference: () => string;
  log: (line: string) => void;
}): string {
  if (!input.isInternal(input.error)) {
    return (input.error as Error).message;
  }
  const reference = input.createReference();
  input.log(`internal error ${reference}: ${input.error instanceof Error ? (input.error.stack ?? input.error.message) : String(input.error)}`);
  return `${INTERNAL_MESSAGE} (reference ${reference})`;
}

/** The server's describer: random references, logged to standard error. */
export function describeErrorSafely(error: unknown): string {
  return describeForCaller({ error, isInternal: isInternalError, createReference: randomUUID, log: (line) => console.error(line) });
}
