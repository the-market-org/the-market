/**
 * Sends the server's requests to apps. The address is checked when the connection is made, not only when
 * the app was installed, so a name that later resolves to a private address (DNS rebinding) is refused.
 * Plain http to this machine is allowed only in local development. Redirects are refused.
 */
import { isIP } from "node:net";
import type { HttpReply, HttpRequest } from "@the-market/core";

export const NOT_PUBLIC = "App address is not public";
const LOCAL_HOSTS: readonly string[] = Object.freeze(["localhost", "127.0.0.1"]);

type Resolved = Array<{ address: string; family: number }>;
type LookupCallback = (error: Error | null, address: string | Resolved, family?: number) => void;
export type CheckedLookup = (hostname: string, options: { all?: boolean }, callback: LookupCallback) => void;

/** True when this request may use plain http to this machine: local development only. */
export function isLocalDevelopment(input: { url: URL; allowLocalHttp: boolean }): boolean {
  return input.allowLocalHttp && input.url.protocol === "http:" && LOCAL_HOSTS.includes(input.url.hostname);
}

/** The URL, when it may be requested: public https, or local http in development; a refusal otherwise. */
export function checkRequestUrl(input: { url: URL; allowLocalHttp: boolean; isPrivate: (address: string) => boolean }): URL {
  const local = isLocalDevelopment(input);
  const literal = input.url.hostname.replace(/^\[|\]$/g, "");
  const allowed = local || (input.url.protocol === "https:" && !(isIP(literal) !== 0 && input.isPrivate(literal)));
  if (!allowed) {
    throw new Error(NOT_PUBLIC);
  }
  return input.url;
}

/** A DNS lookup for http(s).request that refuses the connection when any resolved address is private. */
export function buildCheckedLookup(input: {
  resolve: (hostname: string) => Promise<Resolved>;
  isPrivate: (address: string) => boolean;
  allowPrivate: boolean;
}): CheckedLookup {
  return (hostname, options, callback) => {
    input
      .resolve(hostname)
      .then((resolved) => {
        const refused = resolved.length === 0 || (!input.allowPrivate && resolved.some((entry) => input.isPrivate(entry.address)));
        return refused ? callback(new Error(NOT_PUBLIC), "") : options.all ? callback(null, resolved) : callback(null, String(resolved[0]?.address), resolved[0]?.family);
      })
      .catch((error: Error) => callback(error, ""));
  };
}

type RequestOptions = { method: string; headers: Record<string, string>; lookup: CheckedLookup; timeout: number };
type IncomingReply = { statusCode?: number; on: (event: string, listener: (chunk: Buffer) => void) => void };
type Outgoing = { on: (event: string, listener: (error: Error) => void) => void; end: (body?: string) => void; destroy: (error: Error) => void };
export type RequestFunction = (url: URL, options: RequestOptions, onReply: (reply: IncomingReply) => void) => Outgoing;

/** Sends one request to an app through the checked lookup; a redirect or a timeout fails the request. */
export function sendAppRequest(input: {
  request: HttpRequest;
  allowLocalHttp: boolean;
  isPrivate: (address: string) => boolean;
  lookup: CheckedLookup;
  timeoutMs: number;
  requestFor: (protocol: string) => RequestFunction;
}): Promise<HttpReply> {
  return new Promise((resolve, reject) => {
    const url = checkRequestUrl({ url: new URL(input.request.url), allowLocalHttp: input.allowLocalHttp, isPrivate: input.isPrivate });
    const options = { method: input.request.method, headers: input.request.headers, lookup: input.lookup, timeout: input.timeoutMs };
    const outgoing = input.requestFor(url.protocol)(url, options, (reply) => {
      const chunks: Buffer[] = [];
      reply.on("data", (chunk) => chunks.push(chunk));
      reply.on("end", () => resolveReply({ status: Number(reply.statusCode), bodyText: Buffer.concat(chunks).toString("utf8"), resolve, reject }));
    });
    outgoing.on("error", reject);
    outgoing.on("timeout" as string, () => outgoing.destroy(new Error("App did not answer in time")));
    outgoing.end(input.request.method === "GET" ? undefined : input.request.bodyText);
  });
}

/** Resolves a finished reply, or rejects a redirect, which apps may not use. */
export function resolveReply(input: { status: number; bodyText: string; resolve: (reply: HttpReply) => void; reject: (error: Error) => void }): void {
  if (input.status >= 300 && input.status < 400) {
    input.reject(new Error("App redirects are refused"));
    return;
  }
  input.resolve({ status: input.status, headers: {}, bodyText: input.bodyText });
}
