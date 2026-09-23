# Product

## What commerce-core v1 is

commerce-core is a reusable foundation for delivering custom online stores to small merchants without rebuilding catalog publishing, checkout and order handling for every client.

The initial business model is service-led. Build stores for real clients, learn repeated requirements, then move repeated needs into the core.

It is not a Shopify replacement.

## Initial merchant

The first target merchant:

- sells mainly through Facebook, Zalo or similar channels
- has a small catalog
- wants a proper store website without learning web development
- wants to keep their own payment account
- values a storefront that does not look like every other template

## v1 merchant flow

```text
Admin login
-> edit product or store settings
-> optimize product image
-> Save draft
-> inspect Cloudflare Pages preview
-> Publish
```

Git stays underneath the experience. The merchant sees Draft, Preview and Publish, not branch/commit terminology.

## v1 shopper flow

```text
Browse
-> cart
-> checkout
-> shipping
-> COD / bank transfer / optional PayOS
-> order created
-> merchant manages fulfillment
```

## v1 capabilities

### Catalog

- store settings in Git
- products in Git
- product image compression in Admin Portal
- GitHub-backed draft and production publishing
- Cloudflare Pages branch preview link

### Commerce

- authoritative server-side checkout totals
- D1 order storage
- order item price snapshots
- COD
- manual bank transfer
- optional payOS payment link + verified webhook
- public order status protected by random order token

### Admin

- password session
- product editor
- store settings
- order list
- manual payment/fulfillment status updates
- paid revenue summary
- CSV order export in the browser

## Data ownership

Git owns:

- store identity
- products
- content
- policies
- static assets
- storefront code

D1 owns:

- orders
- order item snapshots
- payment state
- fulfillment state
- payment events

## Explicitly not v1

- drag-and-drop builder
- customer accounts
- CRM
- loyalty
- omnichannel sync
- carrier API integration
- advanced inventory
- tax filing
- accounting
- coupons
- multi-tenant SaaS
- user-managed GitHub onboarding

For tax/accounting workflow, v1 provides order data that can be exported. It does not calculate or file tax.
