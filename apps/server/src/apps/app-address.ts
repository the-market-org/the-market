/**
 * Refuses app addresses that could reach the store's own network. Installing an app makes the
 * server fetch that address, so a merchant must not be able to point it at an internal service.
 */
import { BlockList, isIP } from "node:net";

const PRIVATE_RANGES = new BlockList();
for (const [network, prefix] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16]] as const) {
  PRIVATE_RANGES.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10]] as const) {
  PRIVATE_RANGES.addSubnet(network, prefix, "ipv6");
}

const LOCAL_HOSTS: readonly string[] = Object.freeze(["localhost", "127.0.0.1"]);

/** True for loopback, private, link-local, shared, unique-local and unspecified addresses. */
export function isPrivateAddress(address: string): boolean {
  return PRIVATE_RANGES.check(address, isIP(address) === 6 ? "ipv6" : "ipv4");
}

/** The parsed address, or a blank one that every check refuses. */
export function readUrl(text: string): URL {
  try {
    return new URL(text);
  } catch {
    return new URL("about:blank");
  }
}

/** The addresses an https URL reaches, when every one of them is public; otherwise none. */
export async function listPublicAddresses(input: { url: URL; lookupAddress: (host: string) => Promise<string[]>; isPrivate: typeof isPrivateAddress }): Promise<string[]> {
  if (input.url.protocol !== "https:") {
    return [];
  }
  const hostname = input.url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(hostname) === 0 ? await input.lookupAddress(hostname) : [hostname];
  return addresses.every((address) => !input.isPrivate(address)) ? addresses : [];
}

/** Throws unless the address is public https, or plain http to this machine when that is allowed (never in production). */
export async function checkAppAddress(input: {
  baseUrl: string;
  allowLocalHttp: boolean;
  lookupAddress: (host: string) => Promise<string[]>;
  isPrivate: typeof isPrivateAddress;
}): Promise<void> {
  const url = readUrl(input.baseUrl);
  const localDevelopment = input.allowLocalHttp && url.protocol === "http:" && LOCAL_HOSTS.includes(url.hostname);
  const allowed = localDevelopment || (await listPublicAddresses({ url, lookupAddress: input.lookupAddress, isPrivate: input.isPrivate })).length > 0;
  if (!allowed) {
    throw new Error("Invalid input: baseUrl must be a public https address");
  }
}
