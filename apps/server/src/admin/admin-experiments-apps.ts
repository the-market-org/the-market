/** The merchant screen's experiments and apps pages. Every action goes through the same services as the merchant API. */
import { resolveService } from "@the-market/core";
import type { CapabilityRegistry, HttpReply, ModuleRegistry } from "@the-market/core";
import { escapeHtml } from "@the-market/theme-engine";
import { applyChangeSet } from "../change-sets/apply-workflow.ts";
import { answerChangeSetError } from "../change-sets/change-set-http.ts";
import { buildChangeSetSteps } from "../change-sets/compose-change-sets.ts";
import { describeError } from "../change-sets/item-steps.ts";
import { adoptExperiment } from "../experiments/compose-experiments.ts";
import type { Route, RouteRequest } from "../hono-adapter.ts";

type Arm = { visitors: number; conversions: number };
type Outcome = { decision: string; reason: string; goal: { control: Arm; variant: Arm; zScore: number } };
type Experiment = { experimentId: string; variantChangeSetId: string; name: string; pageKey: string; goalMetric: string; state: string; outcome: unknown };
type App = { appId: string; name: string; status: string };

const form = (action: string, label: string, field = "") => `<form method="post" action="${action}">${field}<button>${label}</button></form>`;

/** One experiment: what it tests, its state, its outcome's numbers when decided, and the action its state allows. */
export function renderExperimentRow(experiment: Experiment): string {
  const outcome = experiment.outcome as Outcome | null;
  const base = `/admin/experiments/${encodeURIComponent(experiment.experimentId)}`;
  const arms = outcome === null ? "" : ` · ${escapeHtml(outcome.decision)}: ${escapeHtml(outcome.reason)} · control ${outcome.goal.control.conversions}/${outcome.goal.control.visitors}, variant ${outcome.goal.variant.conversions}/${outcome.goal.variant.visitors}, z ${outcome.goal.zScore.toFixed(2)}`;
  const action = experiment.state === "running" ? form(`${base}/decide`, "Decide") : ["adopt", "unclear"].includes(String(outcome?.decision)) && experiment.state === "decided" ? form(`${base}/adopt`, "Adopt") : "";
  return `<li>${escapeHtml(experiment.name)} <span>${escapeHtml(experiment.pageKey)} · ${escapeHtml(experiment.goalMetric)} · ${escapeHtml(experiment.state)}${arms}</span>${action}</li>`;
}

/** One app: its name and status, with allow and refuse for an app waiting for the owner. */
export function renderAppRow(app: App): string {
  const base = `/admin/apps/${encodeURIComponent(app.appId)}/decision`;
  const decide = app.status === "pending" ? `${form(base, "Allow", '<input type="hidden" name="decision" value="allowed">')}${form(base, "Refuse", '<input type="hidden" name="decision" value="refused">')}` : "";
  return `<li>${escapeHtml(app.name)} <span>${escapeHtml(app.status)}</span>${decide}</li>`;
}

export function composeAdminExperimentsAppsRoutes(input: {
  registry: ModuleRegistry;
  capabilities: CapabilityRegistry;
  readNow: () => number;
  renderPage: (page: { title: string; mainHtml: string; signedIn: boolean }) => string;
}): Route[] {
  const call = (moduleName: string, serviceName: string) => async (request: unknown) => (resolveService({ registry: input.registry, moduleName, serviceName }) as (request: unknown) => Promise<any>)(request);
  const changeSetSteps = buildChangeSetSteps(input);
  const page = (status: number, title: string, mainHtml: string): HttpReply => ({ status, headers: { "content-type": "text/html; charset=utf-8" }, bodyText: input.renderPage({ title, mainHtml, signedIn: true }) });
  const notice = (message: string) => (message === "" ? "" : `<p role="alert">${escapeHtml(message)}</p>`);
  const showExperiments = async (request: RouteRequest, status: number, message: string) => {
    const experiments = (await call("experiments", "listExperiments")({ tenantId: request.tenantId })) as Experiment[];
    return page(status, "Experiments", `<p><a href="/admin">Home</a></p><h1>Experiments</h1>${notice(message)}<ul>${experiments.map(renderExperimentRow).join("")}</ul>`);
  };
  const showApps = async (request: RouteRequest, status: number, message: string) => {
    const apps = (await call("apps", "listApps")({ tenantId: request.tenantId })) as App[];
    return page(status, "Apps", `<p><a href="/admin">Home</a></p><h1>Apps</h1>${notice(message)}<ul>${apps.map(renderAppRow).join("")}</ul>`);
  };
  const act = (show: typeof showExperiments, location: string, run: (request: RouteRequest) => Promise<unknown>) => async (request: RouteRequest) =>
    run(request).then(
      (): HttpReply => ({ status: 303, headers: { location }, bodyText: "" }),
      (error: unknown) => show(request, answerChangeSetError(describeError(error)).status, describeError(error)),
    );
  const experimentKeys = (request: RouteRequest) => ({ tenantId: request.tenantId, experimentId: String(request.pathParams.experimentId) });
  const route = (method: Route["method"], path: string, handle: Route["handleRequest"]): Route => ({ method, path, tenantScoped: true, handleRequest: handle });
  return [
    route("GET", "/admin/experiments", (request) => showExperiments(request, 200, "")),
    route("POST", "/admin/experiments/:experimentId/decide", act(showExperiments, "/admin/experiments", (request) => call("experiments", "decideExperiment")({ ...experimentKeys(request), now: new Date(input.readNow()).toISOString() }))),
    route("POST", "/admin/experiments/:experimentId/adopt", act(showExperiments, "/admin/experiments", (request) =>
      adoptExperiment({ ...experimentKeys(request), findExperiment: call("experiments", "findExperiment"), applyVariant: (keys) => applyChangeSet(changeSetSteps(keys)), markAdopted: call("experiments", "markAdopted") }),
    )),
    route("GET", "/admin/apps", (request) => showApps(request, 200, "")),
    route("POST", "/admin/apps/:appId/decision", act(showApps, "/admin/apps", (request) =>
      call("apps", "decideApp")({ tenantId: request.tenantId, appId: String(request.pathParams.appId), decision: String(new URLSearchParams(request.bodyText).get("decision") ?? "") }),
    )),
  ];
}
