import type { CheckoutRequest, Env, PaymentMethod, Product, StoreConfig } from "./types";
import { HttpError } from "./http";
import { loadPublicCatalog } from "./catalog";
import { PayOS } from "@payos/node";

interface OrderRow {
  id: string;
  public_token: string;
  store_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  shipping_method: string;
  payment_method: PaymentMethod;
  subtotal: number;
  shipping_fee: number;
  total: number;
  currency: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  payos_order_code: number | null;
  created_at: string;
  updated_at: string;
}

function safeText(value: unknown, max: number, label: string): string {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) {
    throw new HttpError(400, "INVALID_CUSTOMER", label + " is required and must be at most " + max + " characters.");
  }
  return text;
}

function makeOrderId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return "ORD-" + date + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();
}

function makePublicToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function makePayOSOrderCode(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

function payosClient(env: Env): PayOS {
  if (!env.PAYOS_CLIENT_ID || !env.PAYOS_API_KEY || !env.PAYOS_CHECKSUM_KEY) {
    throw new HttpError(503, "PAYOS_NOT_CONFIGURED", "PayOS is enabled for the store but Worker secrets are missing.");
  }

  return new PayOS({
    clientId: env.PAYOS_CLIENT_ID,
    apiKey: env.PAYOS_API_KEY,
    checksumKey: env.PAYOS_CHECKSUM_KEY
  });
}

function validateCheckout(input: CheckoutRequest, store: StoreConfig, products: Product[]) {
  if (input.storeId !== store.id) {
    throw new HttpError(400, "INVALID_STORE", "Checkout store does not match the published store.");
  }

  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 50) {
    throw new HttpError(400, "INVALID_CART", "Cart must contain between 1 and 50 items.");
  }

  if (!store.checkout.paymentMethods.includes(input.paymentMethod)) {
    throw new HttpError(400, "INVALID_PAYMENT_METHOD", "Payment method is not enabled.");
  }

  const shipping = store.checkout.shippingMethods.find((method) => method.id === input.shippingMethod);
  if (!shipping) {
    throw new HttpError(400, "INVALID_SHIPPING_METHOD", "Shipping method is not enabled.");
  }

  const productMap = new Map(products.filter((product) => product.active).map((product) => [product.id, product]));
  const normalizedItems = input.items.map((item) => {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new HttpError(400, "INVALID_CART", "Each cart item needs a valid product and quantity between 1 and 99.");
    }

    const product = productMap.get(item.productId);
    if (!product) {
      throw new HttpError(400, "INVALID_PRODUCT", "One or more products are unavailable.");
    }

    return {
      product,
      quantity: item.quantity,
      lineTotal: product.price * item.quantity
    };
  });

  return { shipping, normalizedItems };
}

export async function createCheckout(input: CheckoutRequest, env: Env) {
  const { store, products } = await loadPublicCatalog(env);
  const { shipping, normalizedItems } = validateCheckout(input, store, products);

  const customer = {
    name: safeText(input.customer?.name, 100, "Customer name"),
    phone: safeText(input.customer?.phone, 30, "Phone"),
    address: safeText(input.customer?.address, 500, "Address")
  };

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const total = subtotal + shipping.fee;
  if (total <= 0) {
    throw new HttpError(400, "INVALID_TOTAL", "Order total must be greater than zero.");
  }

  const now = new Date().toISOString();
  const id = makeOrderId();
  const publicToken = makePublicToken();
  const payosOrderCode = input.paymentMethod === "payos" ? makePayOSOrderCode() : null;
  const orderStatus = input.paymentMethod === "payos" ? "pending_payment" : "confirmed";

  const statements = [
    env.DB.prepare(
      `INSERT INTO orders (
        id, public_token, store_id, customer_name, customer_phone, customer_address,
        shipping_method, payment_method, subtotal, shipping_fee, total, currency,
        status, payment_status, fulfillment_status, payos_order_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      publicToken,
      store.id,
      customer.name,
      customer.phone,
      customer.address,
      shipping.id,
      input.paymentMethod,
      subtotal,
      shipping.fee,
      total,
      store.currency,
      orderStatus,
      "unpaid",
      "new",
      payosOrderCode,
      now,
      now
    )
  ];

  for (const item of normalizedItems) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO order_items (
          order_id, product_id, product_name, unit_price, quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        item.product.id,
        item.product.name,
        item.product.price,
        item.quantity,
        item.lineTotal
      )
    );
  }

  await env.DB.batch(statements);

  const baseResponse = {
    orderId: id,
    orderToken: publicToken,
    status: orderStatus,
    subtotal,
    shippingFee: shipping.fee,
    total,
    currency: store.currency
  };

  if (input.paymentMethod === "cod") {
    return {
      ...baseResponse,
      payment: { type: "none" as const }
    };
  }

  if (input.paymentMethod === "bank_transfer") {
    const bank = store.checkout.bankTransfer;
    if (!bank) {
      throw new HttpError(503, "BANK_TRANSFER_NOT_CONFIGURED", "Bank transfer details are missing from store settings.");
    }

    return {
      ...baseResponse,
      payment: {
        type: "bank_transfer" as const,
        bankName: bank.bankName,
        accountName: bank.accountName,
        accountNumber: bank.accountNumber,
        transferNote: (bank.transferNotePrefix || "DON") + " " + id
      }
    };
  }

  try {
    const payos = payosClient(env);
    const returnBase = env.PAYOS_RETURN_BASE_URL.replace(/\/$/, "") + "/";
    const query = `order=${encodeURIComponent(id)}&token=${encodeURIComponent(publicToken)}`;
    const payment = await payos.paymentRequests.create({
      orderCode: payosOrderCode!,
      amount: total,
      description: "Don " + id.slice(-8),
      returnUrl: returnBase + "?payment=success&" + query,
      cancelUrl: returnBase + "?payment=cancel&" + query
    });

    return {
      ...baseResponse,
      payment: {
        type: "redirect" as const,
        url: payment.checkoutUrl
      }
    };
  } catch (error) {
    console.error("PayOS create payment failed", error);
    await env.DB.prepare(
      "UPDATE orders SET status = ?, payment_status = ?, updated_at = ? WHERE id = ?"
    ).bind("payment_failed", "failed", new Date().toISOString(), id).run();

    throw new HttpError(502, "PAYOS_CREATE_FAILED", "Could not create the PayOS payment link.");
  }
}

export async function getPublicOrder(id: string, token: string, env: Env) {
  if (!id || !token) {
    throw new HttpError(400, "ORDER_TOKEN_REQUIRED", "Order token is required.");
  }

  const order = await env.DB.prepare(
    `SELECT id, status, payment_status, fulfillment_status, total, currency, created_at
     FROM orders WHERE id = ? AND public_token = ?`
  ).bind(id, token).first();

  if (!order) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
  }

  return {
    orderId: order.id,
    status: order.status,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    total: order.total,
    currency: order.currency,
    createdAt: order.created_at
  };
}

export async function handlePayOSWebhook(body: unknown, env: Env) {
  const payos = payosClient(env);
  let verified: any;

  try {
    verified = await payos.webhooks.verify(body as any);
  } catch (error) {
    console.warn("Invalid PayOS webhook", error);
    throw new HttpError(400, "INVALID_PAYOS_WEBHOOK", "Invalid PayOS webhook signature.");
  }

  const orderCode = Number(verified?.orderCode);
  if (!Number.isFinite(orderCode)) {
    throw new HttpError(400, "INVALID_PAYOS_WEBHOOK", "PayOS webhook has no valid order code.");
  }

  const order = await env.DB.prepare(
    "SELECT id FROM orders WHERE payos_order_code = ?"
  ).bind(orderCode).first<{ id: string }>();

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO payment_events (order_id, provider, event_type, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(
    order?.id || null,
    "payos",
    String(verified?.code || "webhook"),
    JSON.stringify(body),
    now
  ).run();

  if (order && String(verified?.code) === "00") {
    await env.DB.prepare(
      `UPDATE orders
       SET status = ?, payment_status = ?, updated_at = ?
       WHERE id = ?`
    ).bind("confirmed", "paid", now, order.id).run();
  }

  return { success: true };
}

export async function listAdminOrders(env: Env) {
  const result = await env.DB.prepare(
    `SELECT id, customer_name, customer_phone, payment_method, total, currency,
            status, payment_status, fulfillment_status, created_at
     FROM orders
     ORDER BY created_at DESC
     LIMIT 200`
  ).all();

  return result.results;
}

export async function updateAdminOrder(
  id: string,
  patch: { paymentStatus?: string; fulfillmentStatus?: string },
  env: Env
) {
  const allowedPayment = new Set(["unpaid", "paid", "failed", "refunded"]);
  const allowedFulfillment = new Set(["new", "preparing", "shipping", "completed", "cancelled"]);

  if (patch.paymentStatus && !allowedPayment.has(patch.paymentStatus)) {
    throw new HttpError(400, "INVALID_PAYMENT_STATUS", "Invalid payment status.");
  }

  if (patch.fulfillmentStatus && !allowedFulfillment.has(patch.fulfillmentStatus)) {
    throw new HttpError(400, "INVALID_FULFILLMENT_STATUS", "Invalid fulfillment status.");
  }

  if (!patch.paymentStatus && !patch.fulfillmentStatus) {
    throw new HttpError(400, "EMPTY_UPDATE", "No order fields to update.");
  }

  const current = await env.DB.prepare(
    "SELECT payment_status, fulfillment_status FROM orders WHERE id = ?"
  ).bind(id).first<{ payment_status: string; fulfillment_status: string }>();

  if (!current) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "Order was not found.");
  }

  const paymentStatus = patch.paymentStatus || current.payment_status;
  const fulfillmentStatus = patch.fulfillmentStatus || current.fulfillment_status;

  await env.DB.prepare(
    `UPDATE orders
     SET payment_status = ?, fulfillment_status = ?, updated_at = ?
     WHERE id = ?`
  ).bind(paymentStatus, fulfillmentStatus, new Date().toISOString(), id).run();

  return { orderId: id, paymentStatus, fulfillmentStatus };
}

export async function adminSummary(env: Env) {
  const row = await env.DB.prepare(
    `SELECT
       COUNT(*) AS orders,
       COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS paid_revenue,
       SUM(CASE WHEN fulfillment_status IN ('new', 'preparing') THEN 1 ELSE 0 END) AS open_orders
     FROM orders`
  ).first();

  return {
    orders: Number(row?.orders || 0),
    paidRevenue: Number(row?.paid_revenue || 0),
    openOrders: Number(row?.open_orders || 0)
  };
}
