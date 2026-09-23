# Product

## What commerce-core is

commerce-core is a reusable foundation for quickly delivering custom online stores to small merchants.

The first business model is service-led: build stores for real clients, learn which requirements repeat, and move repeated needs into the shared core.

It is not a Shopify replacement.

## Target user

Initial merchant:

- sells mainly through Facebook, Zalo or similar channels
- has a small catalog
- wants a proper store website without learning web development
- wants to keep their own payment methods such as COD, bank transfer or PayOS
- values a storefront that can look different from a generic template

## Core outcome

A merchant can maintain a simple catalog and publish a custom storefront while the implementation stays reusable across clients.

A shopper can browse products, add items to a cart and submit checkout information through a consistent frontend contract.

## v0.1

v0.1 exists to make the architecture tangible, not to be production commerce software.

Included:

- store and product contract drafts
- storefront contract
- commerce API contract draft
- static Admin Portal prototype
- image resize/compression before an image would be committed
- static storefront demo
- AI skill for building compatible storefronts

## Admin flow

```text
Edit product
-> optimize image
-> save draft
-> preview
-> publish
```

In v0.1 Save draft is local and Publish is a demo handoff. A backend Git adapter is intentionally not connected yet.

Later, these concepts map to Git operations without exposing Git terminology to merchants.

## Shopper flow

```text
Browse
-> view product
-> add to cart
-> checkout
-> choose payment method
-> create order
```

v0.1 demonstrates the browser flow only. It does not create a real order.

## Product boundaries

Store repository owns:

- store identity
- catalog content
- product images
- policies
- theme/content configuration
- static frontend source

Commerce backend will own:

- orders
- payment status and payment events
- fulfillment state
- revenue records
- realtime inventory if it becomes necessary

## Not now

Do not add yet:

- drag-and-drop storefront builder
- customer accounts
- CRM
- loyalty
- omnichannel sync
- warehouse management
- tax filing
- accounting
- advanced inventory
- multi-tenant SaaS administration
- complex theme system

## Done for v0.1

v0.1 is useful when a developer can:

1. understand the intended data boundaries from the docs and contracts
2. run Admin Portal and storefront locally without installing dependencies
3. edit a demo product and optimize an uploaded image in Admin Portal
4. browse products, use a cart and complete a demo checkout in the storefront
5. use `frontend/SKILL.md` to understand how another compatible storefront should be generated
