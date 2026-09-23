# Storefront Contract v0.1

A storefront is replaceable. It may use any framework or no framework.

## Inputs

A compatible storefront must understand:

- Store v0.1
- Product v0.1

See the JSON Schemas in this directory.

## Required behavior

A storefront must:

1. render the store identity
2. list active products
3. expose a way to view enough product detail to make a purchase decision
4. add/remove/update cart quantities
5. collect customer name, phone and delivery address at checkout
6. offer only payment and shipping methods enabled by the store
7. send product identifiers and quantities to the commerce API
8. treat totals returned by the commerce API as authoritative when a real API is connected
9. provide clear loading, empty and error states
10. work at mobile widths

## Product identity

Use `product.id` as the canonical identifier.

Use `product.slug` for human-friendly URLs when the storefront supports product routes.

Do not use the display name as an identifier.

## Cart item

Minimum cart representation:

```json
{
  "productId": "pixel-clock-mini",
  "quantity": 1
}
```

Do not persist price as authoritative transaction data.

## Required policy surface

A production storefront should provide links to:

- shipping policy
- return/refund policy
- privacy policy
- terms when applicable

Policy file format and route layout are not fixed in v0.1.

## Accessibility and mobile

- interactive controls need usable touch targets
- images need meaningful alt text
- form controls need labels
- do not require hover for core actions
- checkout must remain usable around 375px width

## AI-generated storefronts

AI may freely change layout, styling and component implementation.

AI must not change the data contracts or checkout semantics simply to fit a chosen design.
