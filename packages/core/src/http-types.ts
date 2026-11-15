/** Plain HTTP shapes shared by packages, so none of them depends on a framework. */
export interface HttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyText: string;
}

export interface HttpReply {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
}

export type SendRequest = (request: HttpRequest) => Promise<HttpReply>;

type FetchLike = (
  url: string,
  options: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; text: () => Promise<string> }>;

/** Adapts a fetch implementation to the SendRequest port. */
export async function sendHttpRequest(input: {
  fetchImpl: FetchLike;
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyText: string;
}): Promise<HttpReply> {
  const hasBody = input.method !== "GET";
  const response = await input.fetchImpl(input.url, {
    method: input.method,
    headers: input.headers,
    body: hasBody ? input.bodyText : undefined,
  });
  return { status: response.status, headers: {}, bodyText: await response.text() };
}
