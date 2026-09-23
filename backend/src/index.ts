import type { AdminProductSaveRequest, AdminStoreSaveRequest, CheckoutRequest, Env } from "./types";
import { login, requireAdmin } from "./auth";
import { loadPublicCatalog } from "./catalog";
import { createCheckout, getPublicOrder, handlePayOSWebhook, listAdminOrders, updateAdminOrder, adminSummary } from "./orders";
import { saveProduct, saveStore } from "./github";
import { corsHeaders, errorResponse, json, readJson, withCors } from "./http";

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/api/v1/admin");
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const adminPath = isAdminPath(pathname);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env, adminPath) });
  }

  if (request.method === "GET" && pathname === "/health") {
    return json({ ok: true, version: "1" });
  }

  if (request.method === "POST" && pathname === "/api/v1/checkout") {
    const input = await readJson<CheckoutRequest>(request);
    return json(await createCheckout(input, env), 201);
  }

  const publicOrderMatch = pathname.match(/^\/api\/v1\/orders\/([^/]+)$/);
  if (request.method === "GET" && publicOrderMatch) {
    return json(await getPublicOrder(
      decodeURIComponent(publicOrderMatch[1]),
      url.searchParams.get("token") || "",
      env
    ));
  }

  if (request.method === "POST" && pathname === "/api/v1/webhooks/payos") {
    const body = await readJson<unknown>(request);
    return json(await handlePayOSWebhook(body, env));
  }

  if (request.method === "POST" && pathname === "/api/v1/admin/session") {
    const input = await readJson<{ password?: string }>(request);
    return json(await login(String(input.password || ""), env));
  }

  if (adminPath) {
    await requireAdmin(request, env);
  }

  if (request.method === "GET" && pathname === "/api/v1/admin/catalog") {
    return json(await loadPublicCatalog(env));
  }

  if (request.method === "POST" && pathname === "/api/v1/admin/products/save") {
    const input = await readJson<AdminProductSaveRequest>(request);
    return json(await saveProduct(env, input));
  }

  if (request.method === "POST" && pathname === "/api/v1/admin/store/save") {
    const input = await readJson<AdminStoreSaveRequest>(request);
    return json(await saveStore(env, input));
  }

  if (request.method === "GET" && pathname === "/api/v1/admin/orders") {
    return json({ orders: await listAdminOrders(env) });
  }

  if (request.method === "GET" && pathname === "/api/v1/admin/summary") {
    return json(await adminSummary(env));
  }

  const adminOrderMatch = pathname.match(/^\/api\/v1\/admin\/orders\/([^/]+)$/);
  if (request.method === "PATCH" && adminOrderMatch) {
    const patch = await readJson<{ paymentStatus?: string; fulfillmentStatus?: string }>(request);
    return json(await updateAdminOrder(decodeURIComponent(adminOrderMatch[1]), patch, env));
  }

  return json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const admin = isAdminPath(new URL(request.url).pathname);

    try {
      return withCors(await route(request, env), request, env, admin);
    } catch (error) {
      return withCors(errorResponse(error), request, env, admin);
    }
  }
};
