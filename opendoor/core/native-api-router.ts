// SPDX-License-Identifier: GPL-2.0-only

export type NativeRequest = {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: URLSearchParams;
  context?: Record<string, unknown>;
};

export type NativeResponse = {
  status: number;
  headers?: Record<string, string>;
  body?: unknown;
};

export type NativeHandler = (request: NativeRequest) => Promise<NativeResponse> | NativeResponse;
export type NativeMiddleware = (request: NativeRequest, next: () => Promise<NativeResponse>) => Promise<NativeResponse>;

type Route = { method: string; pattern: string; handler: NativeHandler };

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i];
    const actual = pathParts[i];
    if (expected.startsWith(':')) params[expected.slice(1)] = decodeURIComponent(actual);
    else if (expected !== actual) return null;
  }
  return params;
}

export class AngelNativeApiRouter {
  private readonly routes: Route[] = [];
  private readonly middleware: NativeMiddleware[] = [];

  use(middleware: NativeMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  route(method: string, pattern: string, handler: NativeHandler): this {
    this.routes.push({ method: method.toUpperCase(), pattern, handler });
    return this;
  }

  get(pattern: string, handler: NativeHandler) { return this.route('GET', pattern, handler); }
  post(pattern: string, handler: NativeHandler) { return this.route('POST', pattern, handler); }
  put(pattern: string, handler: NativeHandler) { return this.route('PUT', pattern, handler); }
  delete(pattern: string, handler: NativeHandler) { return this.route('DELETE', pattern, handler); }

  async handle(input: NativeRequest): Promise<NativeResponse> {
    const method = input.method.toUpperCase();
    const route = this.routes.find((candidate) => candidate.method === method && matchPattern(candidate.pattern, input.path));
    if (!route) return { status: 404, body: { error: 'not_found' } };

    const params = matchPattern(route.pattern, input.path) ?? {};
    const request = { ...input, method, params };
    let index = -1;
    const dispatch = async (): Promise<NativeResponse> => {
      index += 1;
      if (index < this.middleware.length) return this.middleware[index](request, dispatch);
      return route.handler(request);
    };
    return dispatch();
  }
}

export const jsonHeaders: NativeMiddleware = async (_request, next) => {
  const response = await next();
  return { ...response, headers: { 'content-type': 'application/json; charset=utf-8', ...(response.headers ?? {}) } };
};
