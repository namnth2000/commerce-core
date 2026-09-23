# Storefront Contract v1

A storefront is replaceable. It may use any framework or no framework.

## Inputs

A compatible storefront reads:

- `data/store.json` matching `store.schema.json`
- `data/products.json`, an array of `product.schema.json`

## Required flow

```text
Browse
-> view product
-> add/update/remove cart item
-> checkout
-> select enabled shipping/payment
-> POST /api/v1/checkout
-> follow the returned payment action
```

## Product identity

- `product.id` is canonical
- `product.slug` is presentation/routing
- cart items contain only `productId` and `quantity`
- browser prices are display values only

A real checkout must trust the total returned by Commerce API, not a total calculated by the browser.

## Checkout response handling

The storefront must support:

- `payment.type = "none"` for COD
- `payment.type = "bank_transfer"` and render the returned bank details
- `payment.type = "redirect"` and navigate to the returned provider URL

The storefront should retain `orderId` and `orderToken` long enough to show order status.

## Order status

Public status lookup:

```http
GET /api/v1/orders/{orderId}?token={orderToken}
```

The token is required because order IDs alone are not treated as authorization.

## Mobile and accessibility

- core actions must work around 375px width
- no hover-only purchase actions
- form fields need labels
- product images need alt text
- errors need visible text
- loading state should disable duplicate checkout submission

## AI-generated storefronts

AI may freely change layout, styling and implementation.

AI must not:

- change the Store/Product contract for convenience
- put payment provider secrets in frontend code
- trust browser-calculated totals
- bypass the Commerce API for real checkout
