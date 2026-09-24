# commerce-core

A small reusable commerce foundation for service-led custom online stores.

v1 separates slow-changing store content from transaction state:

```text
Git + Cloudflare Pages
store / products / assets / storefront
              |
              | checkout
              v
Cloudflare Worker + D1
orders / payments / fulfillment
```

## v1

Included:

- Git-backed product and store publishing
- Draft branch + Cloudflare Pages preview workflow
- client-side WebP image optimization
- real D1 order storage
- server-authoritative checkout totals
- COD
- manual bank transfer
- optional payOS payment link + verified webhook
- Admin order management
- Storefront contract + AI storefront skill

Not included:

- drag-and-drop builder
- customer accounts
- advanced inventory
- carrier APIs
- CRM/accounting/tax filing
- multi-tenant SaaS

## Repository

```text
commerce-core/
├── admin/       Merchant Admin Portal
├── backend/     Cloudflare Worker + D1
├── contracts/   Store, product, order and API v1 contracts
├── docs/        Product, architecture, deployment and security
└── frontend/    DeskJoy demo storefront + AI storefront skill
```

## Local start

Start the static Admin + Storefront from repository root:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000/admin/
http://localhost:8000/frontend/
```

Then start the Worker:

```bash
cd backend
npm install
cp wrangler.toml.example wrangler.toml
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

The static apps default to:

```text
http://localhost:8787
```

For basic local testing, set only:

```text
ADMIN_PASSWORD=...
SESSION_SECRET=...
```

in `backend/.dev.vars`.

With the default local `CATALOG_BASE_URL`, both checkout and Admin read:

```text
http://localhost:8000/frontend/data
```

So a GitHub token is **not required** for:

- Admin login
- viewing/editing the loaded product form
- viewing store settings
- Orders
- COD / bank-transfer checkout
- local D1 order updates

`GITHUB_TOKEN` is only required when testing:

- Save draft
- Preview
- Publish

See `docs/DEPLOYMENT.md` for the full setup.

## Deploy

Follow `docs/DEPLOYMENT.md` step by step.

Production direction:

- Storefront: Cloudflare Pages
- Admin Portal: Cloudflare Pages
- API: Cloudflare Worker
- Orders/payment state: D1
- Published catalog reads: `CATALOG_BASE_URL`
- Catalog/content/assets publishing: GitHub
- Product assets: Git in v1, R2 later only if needed

## Development

Read:

1. `AGENTS.md`
2. `docs/PRODUCT.md`
3. `docs/ARCHITECTURE.md`
4. `contracts/`
5. `docs/DESIGN.md`

Keep changes driven by repeated real merchant needs.
