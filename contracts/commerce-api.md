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
