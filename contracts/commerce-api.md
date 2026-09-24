# Commerce API Contract v1

Base path:

```text
/api/v1
```

## POST /checkout

Request:

```json
{
  "storeId": "deskjoy",
  "items": [
    { "productId": "groot-planter", "quantity": 1 }
  ],
  "customer": {
    "name": "Nguyen Van A",
    "phone": "0900000000",
    "address": "Ha Noi"
  },
  "shippingMethod": "standard",
  "paymentMethod": "cod"
}
```

Do not send authoritative price or total.

Success:

```json
{
  "orderId": "ORD-20260923-A1B2C3D4",
  "orderToken": "random-private-token",
  "status": "confirmed",
  "subtotal": 295000,
  "shippingFee": 30000,
  "total": 325000,
  "currency": "VND",
  "payment": {
    "type": "none"
  }
}
```

Payment variants:

```json
{ "payment": { "type": "redirect", "url": "https://..." } }
```

```json
{
  "payment": {
    "type": "bank_transfer",
    "bankName": "Example Bank",
    "accountName": "NGUYEN VAN A",
    "accountNumber": "123456789",
    "transferNote": "DON ORD-..."
  }
}
```

## GET /orders/{orderId}?token={orderToken}

Returns public-safe order status. Customer PII is not returned.

## POST /webhooks/payos

Receives payOS webhook JSON. The Worker verifies the webhook with the store's payOS checksum key before updating payment state.

## Admin API

All admin routes except session creation require an HMAC-signed admin session token.

```text
POST  /admin/session
GET   /admin/catalog
POST  /admin/products/save
POST  /admin/store/save
GET   /admin/orders
GET   /admin/summary
PATCH /admin/orders/{orderId}
```

Product save request uses an `images` array of `{ filename, contentBase64 }` uploads. The product's `images` list defines cover/order; upload filenames must match referenced paths. A product supports up to 10 images, each optimized to WebP and at most 1.5 MB. Older clients may still send one `image` object. On publish, missing images are copied from the product draft to production before updating catalog JSON.

GitHub credentials remain Worker secrets and are never returned to the browser.

## Error shape

```json
{
  "error": {
    "code": "INVALID_PRODUCT",
    "message": "One or more products are unavailable."
  }
}
```

Stable `error.code` values are for frontend handling. Message text may change.
