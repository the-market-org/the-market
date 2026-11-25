/**
 * Creates a store through the platform routes of a running server, as the publisher would.
 * Usage: PLATFORM_TOKEN=... IDENTITY_SECRET=... node scripts/create-store.ts --name "Shop D" --host shop-d.localhost
 *        [--slug shop-d] [--events-url https://agent.example/events] [--events name,name] [--server http://localhost:3933]
 * Prints the tenant id, a one-hour merchant token for the store, and the agent connection's signing secret.
 */
import { signSegments } from "../packages/sockets/src/index.ts";
import { slugForHost } from "./seed.ts";

type Send = (input: { method: string; path: string; body: unknown }) => Promise<{ status: number; body: Record<string, unknown> }>;

const TOKEN_LIFETIME_SECONDS = 3600;
const DEFAULT_EVENTS = "changes.change-set.moved,orders.order.paid,catalog.product.created";

/** A merchant token for one store, in the shape the identity socket checks (HS256, sub, exp, app_metadata). */
export function signMerchantToken(input: { tenantId: string; secret: string; nowSeconds: number; sign: typeof signSegments }): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claims = { sub: `merchant-of-${input.tenantId}`, exp: input.nowSeconds + TOKEN_LIFETIME_SECONDS, app_metadata: { tenant_id: input.tenantId, role: "merchant" } };
  const signingInput = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}`;
  return `${signingInput}.${input.sign({ signingInput, secret: input.secret })}`;
}

/** Stops with the server's error when a platform call did not succeed. */
export function requireSuccess(input: { status: number; body: Record<string, unknown>; step: string }): Record<string, unknown> {
  if (input.status >= 300) {
    throw new Error(`${input.step} failed with ${input.status}: ${String(input.body.error ?? "")}`);
  }
  return input.body;
}

/** Creates the store, then registers its agent connection when an events address is given. */
export async function createHostedStore(input: { name: string; host: string; slug: string; eventsUrl: string; eventNames: string[]; send: Send }) {
  const created = requireSuccess({ ...(await input.send({ method: "POST", path: "/api/platform/tenants", body: { slug: input.slug, name: input.name, primaryHost: input.host } })), step: "Creating the store" });
  const tenantId = String(created.tenantId);
  const connect = () => input.send({ method: "PUT", path: `/api/platform/tenants/${tenantId}/agent-connection`, body: { eventsUrl: input.eventsUrl, eventNames: input.eventNames } });
  const connection = input.eventsUrl === "" ? { signingSecret: "" } : requireSuccess({ ...(await connect()), step: "Registering the agent connection" });
  return { tenantId, signingSecret: String(connection.signingSecret ?? "") };
}

function readOption(input: { argv: string[]; name: string; fallback: string }): string {
  const position = input.argv.indexOf(`--${input.name}`);
  return position === -1 ? input.fallback : String(input.argv[position + 1]);
}

async function main(argv: string[]): Promise<void> {
  const option = (name: string, fallback: string) => readOption({ argv, name, fallback });
  const server = option("server", "http://localhost:3933");
  const send: Send = async (call) => {
    const response = await fetch(`${server}${call.path}`, { method: call.method, headers: { authorization: `Bearer ${process.env.PLATFORM_TOKEN ?? ""}`, "content-type": "application/json" }, body: JSON.stringify(call.body) });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };
  const host = option("host", "");
  const store = await createHostedStore({ name: option("name", host), host, slug: option("slug", slugForHost(host)), eventsUrl: option("events-url", ""), eventNames: option("events", DEFAULT_EVENTS).split(","), send });
  console.log(`tenant id: ${store.tenantId}`);
  console.log(`merchant token (one hour): ${signMerchantToken({ tenantId: store.tenantId, secret: process.env.IDENTITY_SECRET ?? "", nowSeconds: Math.floor(Date.now() / 1000), sign: signSegments })}`);
  console.log(`agent connection signing secret: ${store.signingSecret || "(no connection registered)"}`);
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
