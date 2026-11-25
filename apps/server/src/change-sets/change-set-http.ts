/** Plain helpers that turn change-set requests and errors into HTTP replies. */
import type { HttpReply, listInputProblems } from "@the-market/core";

/** Status for each known error, matched by message prefix. Anything else is 422. */
const ERROR_STATUSES: ReadonlyArray<readonly [string, number]> = Object.freeze([
  ["Change set not found", 404],
  ["Cart not found", 404],
  ["Order not found", 404],
  ["App not found", 404],
  ["Experiment not found", 404],
  ["invalid_json", 400],
  ["Unknown capability:", 400],
  ["Invalid input:", 400],
  ["Approval needs a name", 400],
  ["Change set is not a draft", 409],
  ["Change set cannot move from", 409],
  ["Cart is already checked out", 409],
  ["App is not waiting for a decision", 409],
  ["Experiment is still running", 409],
  ["Experiment is not running", 409],
  ["Only an adopt or unclear outcome can be adopted", 409],
]);

export function replyJson(input: { status: number; body: unknown }): HttpReply {
  return { status: input.status, headers: { "content-type": "application/json" }, bodyText: JSON.stringify(input.body) };
}

/** Maps an error message to its status, with the message as the body. */
export function answerChangeSetError(message: string): HttpReply {
  const status = ERROR_STATUSES.find(([prefix]) => message.startsWith(prefix))?.[1] ?? 422;
  return replyJson({ status, body: { error: message } });
}

/** Parses a JSON body; an empty body is an empty object. Throws `invalid_json`. */
export function parseJsonBody(bodyText: string): unknown {
  try {
    return JSON.parse(bodyText === "" ? "{}" : bodyText);
  } catch {
    throw new Error("invalid_json");
  }
}

/** Parses and checks a body against a capability-style input schema. */
export function readCheckedBody(input: {
  bodyText: string;
  inputSchema: Record<string, unknown>;
  parse: typeof parseJsonBody;
  listProblems: typeof listInputProblems;
}): Record<string, unknown> {
  const body = input.parse(input.bodyText);
  const problems = input.listProblems({ inputSchema: input.inputSchema, candidate: body });
  if (problems.length > 0) {
    throw new Error(`Invalid input: ${problems.join("; ")}`);
  }
  return body as Record<string, unknown>;
}

/** Runs a handler and turns any thrown error into its reply. */
export async function answerSafely(input: {
  run: () => Promise<HttpReply>;
  answerError: typeof answerChangeSetError;
  describe: (error: unknown) => string;
}): Promise<HttpReply> {
  try {
    return await input.run();
  } catch (error) {
    return input.answerError(input.describe(error));
  }
}
