import type { Env } from "./types";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected application/json.");
  }

  try {
    return await request.json<T>();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }
}

export function corsHeaders(request: Request, env: Env, admin = false): HeadersInit {
  const origin = request.headers.get("origin");
  const allowed = new Set([
    admin ? env.ADMIN_ORIGIN : env.STOREFRONT_ORIGIN,
    "http://localhost:8000",
    "http://127.0.0.1:8000"
  ]);

  if (!origin || !allowed.has(origin)) return {};

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
}

export function withCors(response: Response, request: Request, env: Env, admin = false): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request, env, admin))) {
    if (value != null) headers.set(key, String(value));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return json({ error: { code: error.code, message: error.message } }, error.status);
  }

  console.error(error);
  return json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error."
    }
  }, 500);
}
