/**
 * The only file that knows about Hono. Handlers elsewhere take plain values
 * and return an HttpReply, so the HTTP framework can be swapped here alone.
 */
import type { HttpReply } from "@the-market/core";
import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface RouteRequest {
  /** The store this request is for. Empty for routes that are not tenant scoped. */
  tenantId: string;
  pathParams: Record<string, string>;
  queryValues: Record<string, string>;
  bodyText: string;
}

export interface Route {
  method: "GET" | "POST";
  path: string;
  /** When true, the request's host must belong to a tenant or the reply is 404. */
  tenantScoped: boolean;
  handleRequest: (request: RouteRequest) => Promise<HttpReply>;
}

type ResolveTenant = (host: string) => Promise<string | undefined>;

/** Reads the host the client asked for: the Host header, else the URL's host. */
export function readHost(context: Context): string {
  return context.req.header("host") ?? new URL(context.req.url).host;
}

/** Resolves the tenant, turns the request into plain values, runs the handler. */
export async function answerWithRoute(input: {
  context: Context;
  route: Route;
  resolveTenant: ResolveTenant;
  readRequestHost: (context: Context) => string;
}): Promise<Response> {
  const tenantId = input.route.tenantScoped
    ? await input.resolveTenant(input.readRequestHost(input.context))
    : "";
  if (tenantId === undefined) {
    return input.context.body('{"error":"unknown_store"}', 404, { "content-type": "application/json" });
  }
  const reply = await input.route.handleRequest({
    tenantId,
    pathParams: input.context.req.param(),
    queryValues: input.context.req.query(),
    bodyText: await input.context.req.text(),
  });
  return input.context.body(reply.bodyText, reply.status as ContentfulStatusCode, reply.headers);
}

/** Registers every route on the Hono app. */
export function mountRoutes(input: {
  app: Hono;
  routes: Route[];
  answerRoute: typeof answerWithRoute;
  resolveTenant: ResolveTenant;
}): Hono {
  for (const route of input.routes) {
    input.app.on(route.method, route.path, (context) =>
      input.answerRoute({
        context,
        route,
        resolveTenant: input.resolveTenant,
        readRequestHost: readHost,
      }),
    );
  }
  return input.app;
}
