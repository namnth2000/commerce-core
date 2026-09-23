# Architecture

## Principle

Keep static commerce content separate from transactional state.

```text
                Merchant
                   |
             Admin Portal
                   |
        future Git API Worker
                   |
              Store repo
                   |
          Cloudflare Pages
                   |
              Storefront
                   |
             checkout API
                   |
        future Commerce Worker
                   |
                   D1
```

## Data ownership

### Git repository

Git is the initial source of truth for data that changes relatively infrequently and benefits from review/history:

- store settings
- product catalog
- product descriptions
- product images
- policy content
- frontend code
- theme/content configuration

### Transaction backend

A future Cloudflare Worker + D1 owns data that changes during commerce operations:

- orders
- payment events/status
- fulfillment state
- revenue records
- realtime inventory if added

Do not store orders or payment state as Git commits.

## Admin Portal

The browser UI should use merchant language:

- Save draft
- Preview
- Publish

The backend implementation may translate those actions to:

```text
Save draft -> create/update draft branch
Preview    -> Cloudflare preview deployment
Publish    -> update production branch
```

The browser must not receive a GitHub secret. GitHub API calls requiring credentials belong behind a server-side Worker.

v0.1 intentionally stops before this adapter and uses local demo behavior.

## Images

Initial path:

```text
Upload
-> resize
-> convert to WebP
-> remove unnecessary metadata through re-encoding
-> commit optimized asset
```

Default target for the prototype:

- maximum dimension: 1600px
- WebP quality: 0.82
- original file is not kept by the Admin Portal

Git storage is acceptable for the first small stores. If clone/build speed or asset volume becomes a real problem, replace the asset implementation with R2 without changing product data semantics.

## Storefront

A storefront is replaceable.

Any implementation is valid if it follows:

- `contracts/store.schema.json`
- `contracts/product.schema.json`
- `contracts/storefront.md`
- `contracts/commerce-api.md`

The frontend must not depend on how the commerce backend stores orders.

## Checkout trust boundary

The browser may send product identifiers and quantities.

A production commerce API must not trust browser-supplied prices or totals. The core must resolve authoritative pricing from the published catalog or another server-side catalog representation.

The exact synchronization mechanism is deliberately not fixed in v0.1.

## Deployment direction

First production target:

- frontend: Cloudflare Pages, Git connected
- admin: Cloudflare Pages
- Git adapter: Cloudflare Worker
- commerce API: Cloudflare Worker
- transactions: D1

Do not add these services until the static v0.1 contract has been exercised.
