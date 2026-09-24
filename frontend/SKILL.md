---
name: commerce-core-storefront
description: Build or modify a storefront compatible with commerce-core v1.
version: 1.0.0
---

# commerce-core storefront skill

Use this skill when creating or modifying a storefront that connects to commerce-core v1.

## Read first

1. `../contracts/store.schema.json`
2. `../contracts/product.schema.json`
3. `../contracts/storefront.md`
4. `../contracts/commerce-api.md`
5. `../docs/DESIGN.md`

## Goal

The visual storefront may be completely custom. Commerce semantics must stay compatible.

## Required data

Read static data from:

```text
data/store.json
data/products.json
```

Do not invent a separate catalog shape for a new design.

## Required cart shape

```json
{
  "productId": "groot-planter",
  "quantity": 1
}
```

Do not persist browser price as authoritative transaction data.

## Required checkout

Submit to:

```http
POST <COMMERCE_API_BASE>/api/v1/checkout
```

Send storeId, productId + quantity items, customer name/phone/address, shippingMethod and paymentMethod.

Never send a trusted total. Use the response total as final.

## Payment behavior

Handle all three response modes:

- `none`: show order ID and confirmation
- `bank_transfer`: show returned bank details, transfer note and final total
- `redirect`: navigate to `payment.url`

Do not put payOS credentials in frontend code.

## Payment return

When the storefront receives:

```text
?payment=success&order=...&token=...
```

query:

```http
GET /api/v1/orders/{orderId}?token={orderToken}
```

Do not treat `payment=success` by itself as proof of payment. The Worker updates paid state from verified payOS webhook data.

## Visual freedom

DeskJoy detail pages use `product.html?slug=<slug>`. The first image is the cover; remaining images render in the gallery. The Admin sends an `images` upload array, with filenames matching the product's referenced paths. Both pages share the same cart and checkout flow.

You may change typography, layout, product card, navigation, product detail presentation, motion, color system and responsive composition.

You must preserve product IDs, cart semantics, checkout semantics, order-token privacy, accessible core actions and mobile usability around 375px.

## Implementation preference

Use the simplest stack that fits the requested storefront.

A generated frontend may use a framework if the client experience materially benefits, but do not add infrastructure only because the generator prefers it.
