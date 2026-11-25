/**
 * Simulated shoppers for checking an experiment on a running server.
 * Usage: node scripts/simulate-visitors.ts --host localhost --port 3933 --visitors 400 [--seed 7] [--marker "Free UK delivery"]
 * Each visitor has its own cookies, opens the product page, adds to cart with probability 0.25 when the page shows
 * the marker text and 0.05 when it does not, and pays for a third of carts. A seed makes runs repeat.
 */
import { request } from "node:http";

type Reply = { status: number; setCookies: string[]; text: string };
type Send = (input: { method: string; path: string; cookies: string[]; body: string }) => Promise<Reply>;

const ADD_RATE_WITH_MARKER = 0.25;
const ADD_RATE_WITHOUT_MARKER = 0.05;
const PAY_RATE = 1 / 3;

/** A seeded generator of numbers from 0 to 1 (mulberry32). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** What one visitor does, from two draws: whether they add to cart, and whether they then pay. */
export function chooseActions(input: { seesMarker: boolean; addDraw: number; payDraw: number }): { adds: boolean; pays: boolean } {
  const adds = input.addDraw < (input.seesMarker ? ADD_RATE_WITH_MARKER : ADD_RATE_WITHOUT_MARKER);
  return { adds, pays: adds && input.payDraw < PAY_RATE };
}

/** Cookies kept as name=value pairs, the newest value of each name winning. */
export function keepCookies(input: { cookies: string[]; setCookies: string[] }): string[] {
  const pairs = new Map(input.cookies.map((cookie) => [cookie.split("=")[0], cookie]));
  input.setCookies.map((header) => header.split(";")[0] ?? "").forEach((cookie) => pairs.set(cookie.split("=")[0], cookie));
  return [...pairs.values()].filter((cookie) => !cookie.endsWith("="));
}

/** One visitor's visit; returns what they saw and did. */
export async function simulateVisitor(input: { marker: string; random: () => number; send: Send }) {
  const page = await input.send({ method: "GET", path: "/products/rope-lead", cookies: [], body: "" });
  const productId = /name="productId" value="([^"]+)"/.exec(page.text)?.[1] ?? "";
  const actions = chooseActions({ seesMarker: page.text.includes(input.marker), addDraw: input.random(), payDraw: input.random() });
  const cookies = keepCookies({ cookies: [], setCookies: page.setCookies });
  const added = actions.adds ? await input.send({ method: "POST", path: "/cart/lines", cookies, body: `productId=${productId}&quantity=1` }) : { status: 0, setCookies: [], text: "" };
  const cartCookies = keepCookies({ cookies, setCookies: added.setCookies });
  const paid = actions.pays ? await input.send({ method: "POST", path: "/cart/checkout", cookies: cartCookies, body: "" }) : { status: 0, setCookies: [], text: "" };
  return { seesMarker: page.text.includes(input.marker), adds: added.status === 303, pays: paid.status === 303 };
}

function buildSender(input: { host: string; port: number }): Send {
  return (call) =>
    new Promise((resolve, reject) => {
      const headers = { host: input.host, cookie: call.cookies.join("; "), "content-type": "application/x-www-form-urlencoded" };
      const outgoing = request({ hostname: "127.0.0.1", port: input.port, method: call.method, path: call.path, headers }, (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.on("end", () => resolve({ status: Number(incoming.statusCode), setCookies: incoming.headers["set-cookie"] ?? [], text: Buffer.concat(chunks).toString("utf8") }));
      });
      outgoing.on("error", reject);
      outgoing.end(call.body);
    });
}

function readOption(input: { argv: string[]; name: string; fallback: string }): string {
  const position = input.argv.indexOf(`--${input.name}`);
  return position === -1 ? input.fallback : String(input.argv[position + 1]);
}

async function main(argv: string[]): Promise<void> {
  const option = (name: string, fallback: string) => readOption({ argv, name, fallback });
  const random = createRandom(Number(option("seed", "7")));
  const send = buildSender({ host: option("host", "localhost"), port: Number(option("port", "3933")) });
  const visits: Array<Awaited<ReturnType<typeof simulateVisitor>>> = [];
  for (let visitorNumber = 0; visitorNumber < Number(option("visitors", "400")); visitorNumber += 1) {
    visits.push(await simulateVisitor({ marker: option("marker", "Free UK delivery"), random, send }));
  }
  const count = (seesMarker: boolean, key: "adds" | "pays") => visits.filter((visit) => visit.seesMarker === seesMarker && visit[key]).length;
  const shown = (seesMarker: boolean) => visits.filter((visit) => visit.seesMarker === seesMarker).length;
  console.log(`variant: ${shown(true)} visitors, ${count(true, "adds")} added, ${count(true, "pays")} paid`);
  console.log(`control: ${shown(false)} visitors, ${count(false, "adds")} added, ${count(false, "pays")} paid`);
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
