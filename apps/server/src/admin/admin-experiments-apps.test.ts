import assert from "node:assert/strict";
import { test } from "node:test";
import { composeServer } from "../compose.ts";

const arms = (control: number, variant: number) => ({ control: { visitors: 300, conversions: control }, variant: { visitors: 300, conversions: variant } });

function buildShop() {
  const experiments = [
    { tenantId: "tenant-a", experimentId: "exp_run", variantChangeSetId: "set_v", name: "Running <test>", pageKey: "product", goalMetric: "add_to_cart", state: "running", outcome: null },
    { tenantId: "tenant-a", experimentId: "exp_lost", variantChangeSetId: "set_v", name: "Lost one", pageKey: "home", goalMetric: "add_to_cart", state: "decided", outcome: { decision: "discard", reason: "Goal fell", goal: { ...arms(30, 10), zScore: -3.6512 } } },
  ];
  const apps = [{ tenantId: "tenant-a", appId: "app_1", name: "Review <stars>", status: "pending" }];
  const registry = {
    tenancy: { resolveTenant: async (request: { host: string }) => ({ "shop-a.example": "tenant-a", "shop-b.example": "tenant-b" })[request.host], findTenant: async () => ({ name: "Shop" }) },
    catalog: { listProducts: async () => [] },
    pages: { findPage: async () => undefined },
    connections: { saveConnection: async () => ({ signingSecret: "" }), findConnection: async () => undefined, removeConnection: async () => {} },
    changes: { createChangeSet: async () => ({}), addChangeItem: async () => ({}), listChangeSets: async () => [], findChangeSet: async () => undefined, moveChangeSet: async () => {} },
    experiments: {
      listExperiments: async (query: { tenantId: string }) => experiments.filter((experiment) => experiment.tenantId === query.tenantId),
      findExperiment: async (keys: { tenantId: string; experimentId: string }) => experiments.find((experiment) => experiment.tenantId === keys.tenantId && experiment.experimentId === keys.experimentId) ?? Promise.reject(new Error("Experiment not found")),
      decideExperiment: async () => Promise.reject(new Error("Experiment is still running")),
      markAdopted: async () => 1,
    },
    apps: {
      listApps: async (query: { tenantId: string }) => apps.filter((app) => app.tenantId === query.tenantId),
      decideApp: async (request: { appId: string; decision: string }) => Object.assign(apps.find((app) => app.appId === request.appId) ?? {}, { status: request.decision === "allowed" ? "active" : "refused" }),
    },
  };
  return { registry, apps };
}

async function buildBrowser(shop: ReturnType<typeof buildShop>) {
  const app = await composeServer({ readUptime: () => 0, registry: shop.registry, capabilities: {}, merchantToken: "shared-dev", identity: { verifyToken: async () => undefined }, identityEnabled: false });
  const cookieFor = async (host: string) =>
    String((await app.request("/admin/sign-in", { method: "POST", headers: { host, origin: `https://${host}`, "content-type": "application/x-www-form-urlencoded" }, body: "token=shared-dev" })).headers.get("set-cookie")).split(";")[0];
  return async (input: { method?: string; path: string; host?: string; form?: string }) => {
    const host = input.host ?? "shop-a.example";
    const response = await app.request(input.path, { method: input.method ?? "GET", headers: { host, cookie: await cookieFor(host), origin: `https://${host}`, "content-type": "application/x-www-form-urlencoded" }, body: input.form });
    return { status: response.status, location: response.headers.get("location"), html: await response.text() };
  };
}

test("experiments show their state and a decided one's numbers, escaped, with the action the state allows", async () => {
  const browse = await buildBrowser(buildShop());
  const page = await browse({ path: "/admin/experiments" });
  assert.match(page.html, /<li>Running &lt;test&gt; <span>product · add_to_cart · running<\/span><form method="post" action="\/admin\/experiments\/exp_run\/decide"><button>Decide<\/button><\/form><\/li>/);
  assert.match(page.html, /<li>Lost one <span>home · add_to_cart · decided · discard: Goal fell · control 30\/300, variant 10\/300, z -3.65<\/span><\/li>/, "a discard offers no adopt");
  const early = await browse({ method: "POST", path: "/admin/experiments/exp_run/decide" });
  assert.equal(early.status, 409);
  assert.match(early.html, /<p role="alert">Experiment is still running<\/p>/);
  const adoptDiscard = await browse({ method: "POST", path: "/admin/experiments/exp_lost/adopt" });
  assert.deepEqual([adoptDiscard.status, /Only an adopt or unclear outcome can be adopted/.test(adoptDiscard.html)], [409, true]);
});

test("a pending app is allowed from the screen, and store B sees neither store A's apps nor its experiments", async () => {
  const shop = buildShop();
  const browse = await buildBrowser(shop);
  assert.match((await browse({ path: "/admin/apps" })).html, /<li>Review &lt;stars&gt; <span>pending<\/span>.*value="allowed"><button>Allow<\/button>.*value="refused"><button>Refuse<\/button>/);
  assert.deepEqual(await browse({ method: "POST", path: "/admin/apps/app_1/decision", form: "decision=allowed" }).then((reply) => [reply.status, reply.location]), [303, "/admin/apps"]);
  assert.equal(shop.apps[0]?.status, "active");
  assert.match((await browse({ path: "/admin/apps", host: "shop-b.example" })).html, /<ul><\/ul>/);
  assert.match((await browse({ path: "/admin/experiments", host: "shop-b.example" })).html, /<ul><\/ul>/);
});
