/**
 * The only file that knows about Hono. Handlers elsewhere take plain values
 * and return an HttpReply, so the HTTP framework can be swapped here alone.
 */
import type { HttpReply } from "@the-market/core";
import type { Context, Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface RouteRequest {
  pathParams: Record<string, string>;
  queryValues: Record<string, string>;
  bodyText: string;
}

export interface Route {
  method: "GET" | "POST";
  path: string;
  handleRequest: (request: RouteRequest) => Promise<HttpReply>;
}

/** Turns a Hono request into plain values, runs the handler, sends its reply. */
export async function answerWithRoute(input: {
  context: Context;
  handleRequest: Route["handleRequest"];
}): Promise<Response> {
  const reply = await input.handleRequest({
    pathParams: input.context.req.param(),
    queryValues: input.context.req.query(),
    bodyText: await input.context.req.text(),
  });
  return input.context.body(reply.bodyText, reply.status as ContentfulStatusCode, reply.headers);
}

/** Registers every route on the Hono app. */
export function mountRoutes(input: { app: Hono; routes: Route[]; answerRoute: typeof answerWithRoute }): Hono {
  for (const route of input.routes) {
    input.app.on(route.method, route.path, (context) =>
      input.answerRoute({ context, handleRequest: route.handleRequest }),
    );
  }
  return input.app;
}
