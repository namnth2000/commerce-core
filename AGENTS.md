# AGENTS.md

## Goal

Keep commerce-core small, reusable and understandable. v1 should let one small merchant publish a custom storefront, accept orders and manage basic fulfillment without becoming a general ERP or Shopify clone.

## Source of truth

Use this order when files disagree:

1. current user request
2. `docs/PRODUCT.md`
3. `docs/DESIGN.md`
4. `docs/ARCHITECTURE.md`
5. `contracts/`
6. current implementation

Flag meaningful conflicts instead of silently changing established decisions.

## Durable decisions

- v1 is one store per deployment.
- Git is the source of truth for store configuration, catalog, policies, storefront and static product assets.
- D1 is the source of truth for orders, payment state, fulfillment state and payment events.
- Admin uses Draft, Preview and Publish language. Do not expose Git terminology unless troubleshooting.
- GitHub and payOS secrets are server-only Worker secrets.
- The browser never sends authoritative product prices or order totals.
- Product images are optimized to WebP before Git publishing.
- Storefronts are replaceable implementations of the shared contracts.
- Payment adapters in v1 are COD, manual bank transfer and optional payOS.
- Do not add multi-tenant infrastructure until real client work justifies it.

## Stack

### Static apps

`admin/` and `frontend/` use plain HTML, CSS and JavaScript with no build step.

Do not introduce a frontend framework unless a real requirement needs one.

### Backend

`backend/` is a TypeScript Cloudflare Worker using:

- D1
- GitHub REST API
- `@payos/node`
- Web Crypto

Keep backend modules small and explicit.

## Contract changes

When changing a contract:

1. update schema/docs in `contracts/`
2. update examples
3. update backend validation/behavior
4. update Admin Portal
5. update storefront and `frontend/SKILL.md`

Do not silently introduce breaking contract changes.

## Security

Read `docs/SECURITY.md`.

Never commit real secrets.

Do not treat a payment return URL as payment confirmation. payOS payment state changes only after verified webhook data or an explicitly designed reconciliation flow.

## Verification

Before calling v1 ready:

- TypeScript passes `npm run check`
- D1 migration applies locally
- Admin login works
- Admin loads catalog from GitHub
- Save draft returns a Pages preview URL
- Publish updates production catalog
- image optimization stays under configured payload limit
- storefront loads static catalog
- COD checkout creates a D1 order
- manual bank transfer returns instructions
- payOS path is tested if credentials are available
- public order lookup rejects missing/wrong token
- Admin order status update persists
- UI works around 375px width

Do not claim an integration was tested if credentials or deployed infrastructure were not available.
