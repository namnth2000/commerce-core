# AGENTS.md

## Goal

Keep commerce-core small, reusable and understandable. Build only what is needed to let a small shop publish a custom storefront and receive orders.

## Source of truth

Use this order when files disagree:

1. current user request
2. `docs/PRODUCT.md` for product behavior and scope
3. `docs/DESIGN.md` for UI direction
4. `docs/ARCHITECTURE.md` for technical boundaries
5. `contracts/` for data exchanged between components
6. current implementation

Flag meaningful conflicts instead of silently changing established decisions.

## Durable decisions

- Git is the source of truth for store configuration, product catalog, policies, theme/content and static assets in the first version.
- Git is not the database for orders, payment events, fulfillment state or revenue records.
- Browser code must never contain a GitHub personal access token or other server secret.
- The Admin Portal should expose user concepts such as Save draft, Preview and Publish, not Git terms such as branch, commit and merge.
- Product images may live in Git initially, but the Admin Portal should optimize them before publishing.
- Storefronts must follow the contracts instead of depending on one specific frontend implementation.
- Real totals must eventually be authoritative on the commerce API, not trusted from the browser.
- Prefer Cloudflare Pages for static apps and a Cloudflare Worker + D1 for transactional backend work when that backend is implemented.

## Current stack

v0.1 uses plain HTML, CSS and JavaScript with no build step and no runtime dependencies.

Do not introduce a framework, database, auth system, state library or build tool unless a current requirement justifies it.

## UI

Follow `docs/DESIGN.md`.

Default direction:

- minimal
- calm
- functional
- light
- readable
- responsive
- subtle borders
- little or no shadow
- no decorative UI that does not help the user

## Contract changes

When changing a contract:

1. update the contract source
2. update examples
3. update affected Admin Portal or storefront behavior
4. update docs only if product truth changed

Do not silently make breaking changes. Bump the contract version when compatibility changes materially.

## Verification

For static v0.1 changes:

- open both `/admin/` and `/frontend/` through an HTTP server
- confirm browser console has no obvious errors
- test mobile width around 375px
- verify product edit/save still works in Admin Portal
- verify image optimization still produces a preview and downloadable optimized image
- verify storefront add-to-cart and demo checkout flow
- validate changed JSON files parse correctly

Do not claim a GitHub publish, Cloudflare deploy, payment or database flow works unless it was actually connected and tested.
