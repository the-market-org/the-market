/** Reads the example agent's options. The token never comes from the command line, so it stays out of shell history. */
import { parseArgs } from "node:util";

export interface AgentOptions {
  storeUrl: string;
  /** The store's host name when several stores share one local address; "" uses the store's own. */
  hostHeader: string;
  waitPolls: number;
  agentToken: string;
}

export function readAgentArguments(input: { argv: string[]; environment: Record<string, string | undefined> }): AgentOptions {
  const { values } = parseArgs({ args: input.argv, options: { store: { type: "string", default: "" }, host: { type: "string", default: "" }, wait: { type: "string", default: "0" } } });
  const agentToken = input.environment.AGENT_TOKEN;
  if (!agentToken) {
    throw new Error("Set AGENT_TOKEN to an agent token for the store");
  }
  if (values.store === "") {
    throw new Error("Pass --store <store address>, for example --store http://localhost:3000");
  }
  return { storeUrl: String(values.store), hostHeader: String(values.host), waitPolls: Number(values.wait), agentToken };
}

/** The A2A endpoint the card names, on the store's own address. */
export function localEndpoint(input: { interfaceUrl: string; storeUrl: string }): string {
  return new URL(new URL(input.interfaceUrl).pathname, input.storeUrl).toString();
}

/**
 * The store address with `--host` as its host name, keeping the scheme and port. `fetch` replaces any Host header
 * with the URL's own, so the store's host has to be in the URL; names under `.localhost` resolve to this machine.
 */
export function applyHostName(input: { storeUrl: string; hostName: string }): string {
  const url = new URL(input.storeUrl);
  url.hostname = input.hostName === "" ? url.hostname : input.hostName;
  return url.toString().replace(/\/$/, "");
}
