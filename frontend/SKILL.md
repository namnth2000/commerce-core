---
name: commerce-core-storefront
description: Build or modify a storefront compatible with commerce-core contracts.
version: 0.1.0
---

# commerce-core storefront skill

Use this skill when creating a new storefront implementation for commerce-core.

## Read first

Before editing storefront behavior, read:

1. `../contracts/store.schema.json`
2. `../contracts/product.schema.json`
3. `../contracts/storefront.md`
4. `../contracts/commerce-api.md`
5. `../docs/DESIGN.md` for shared UI principles

## Goal

Create a storefront with a custom visual identity while preserving the shared commerce contract.

Product over technology. Use the simplest frontend stack that fits the requested store.

## Preserve

- `product.id` is the canonical product identifier
- `product.slug` is for human-friendly URLs
- cart items contain product ID and quantity
- a real checkout sends IDs and quantities, not an authoritative total
- payment and shipping choices come from store configuration
- mobile checkout must remain usable
- a frontend must not invent a different product schema just for its design

## Required flow

```text
Browse products
-> view enough product detail
-> add to cart
-> update/remove cart items
-> checkout
-> choose shipping/payment
-> submit to commerce API when connected
```

## Visual freedom

The storefront may change:

- layout
- typography
- spacing
- product card design
- navigation
- product detail presentation
- visual theme

Do not change product or checkout semantics without changing the shared contracts first.

## Current demo

The included v0.1 frontend is dependency-free and uses local demo JSON.

It intentionally simulates checkout because the commerce API is not implemented yet.

When connecting a real API:

1. replace demo checkout with `POST /api/v0.1/checkout`
2. use the response total/status as authoritative
3. handle API errors visibly
4. do not move payment secrets into browser code
