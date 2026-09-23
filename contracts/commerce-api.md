# Commerce API Contract v0.1

This is a draft boundary for storefronts. The backend is not implemented in v0.1.

Base path used in examples:

```text
/api/v0.1
```

## Create checkout

```http
POST /api/v0.1/checkout
Content-Type: application/json
```

Request:

```json
{
  "storeId": "deskbits",
  "items": [
    {
      "productId": "pixel-clock-mini",
      "quantity": 1
    }
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

The request deliberately contains no authoritative price.

Response:

```json
{
  "orderId": "ORD-1001",
  "status": "confirmed",
  "subtotal": 489000,
  "shippingFee": 30000,
  "total": 519000,
  "currency": "VND",
  "payment": {
    "type": "none"
  }
}
```

Possible payment response for a redirect-based provider:

```json
{
  "payment": {
    "type": "redirect",
    "url": "https://payment-provider.example/checkout/..."
  }
}
```

## Get order

```http
GET /api/v0.1/orders/{orderId}
```

Example response:

```json
{
  "orderId": "ORD-1001",
  "status": "confirmed",
  "paymentStatus": "unpaid",
  "fulfillmentStatus": "new",
  "total": 519000,
  "currency": "VND"
}
```

## Trust rules

A production backend must:

- resolve product existence server-side
- resolve authoritative prices server-side
- validate enabled shipping/payment methods
- calculate totals server-side
- validate provider callbacks server-side
- never trust a total sent by the browser

How the backend synchronizes the published Git catalog is intentionally not fixed in v0.1.

## Error shape

```json
{
  "error": {
    "code": "INVALID_PRODUCT",
    "message": "One or more products are unavailable."
  }
}
```

Keep error codes stable enough for storefronts to handle. Human-readable messages may change.
