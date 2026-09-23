# Architecture

## Production shape

```text
                    Merchant
                       |
                 Admin Portal
                 Cloudflare Pages
                       |
                Commerce Worker
                 /api/v1/admin
                       |
          +------------+------------+
          |                         |
      GitHub API                    D1
 catalog/config/assets       orders/payments
          |
    production + draft
          |
    Cloudflare Pages
          |
       Storefront
          |
      /api/v1/checkout
          |
    Commerce Worker
```

v1 is intentionally one store per deployment. Multi-tenant infrastructure is deferred.

## Source of truth

### Git

Git owns relatively slow-changing content:

- `frontend/data/store.json`
- `frontend/data/products.json`
- product assets
- policies
- storefront source

Admin writes to GitHub only through the Worker.

### D1

D1 owns transaction state:

- orders
- order item snapshots
- payment status
- fulfillment status
- payOS events

Orders must never be represented as Git commits.

## Catalog publishing

Save draft:

```text
Admin
-> Worker
-> draft/<slug>
-> GitHub commit(s)
-> Cloudflare Pages preview
```

Publish:

```text
Admin
-> Worker
-> main
-> Cloudflare Pages production deploy
```

GitHub's contents API is used serially. Product image and catalog JSON may be separate commits in v1. This is acceptable for the small-store target and avoids building a custom Git data layer too early.

## Images

Admin Portal:

- accepts browser-readable images
- resizes the largest dimension to at most 1600px
- re-encodes to WebP at quality 0.82
- rejects publish payloads over 1.5 MB after optimization

New product images are stored under:

```text
frontend/assets/products/
```

Git remains the v1 asset store. Move to R2 only when real repositories/builds become painful.

## Checkout trust boundary

The storefront reads public static prices for display.

For checkout, Worker reloads the published catalog from `CATALOG_BASE_URL` and recalculates:

- product availability
- unit prices
- subtotal
- enabled shipping method
- shipping fee
- enabled payment method
- final total

The Worker ignores browser-provided prices because none are accepted by contract.

## Payment

### COD

Order is created as confirmed and unpaid.

### Manual bank transfer

Order is created as confirmed and unpaid. Bank details come from public store config and the Worker returns an order-specific transfer note.

### payOS

Credentials are Worker secrets.

```text
Checkout
-> create D1 order
-> Worker creates payOS payment request
-> shopper pays
-> payOS webhook
-> Worker verifies signature
-> D1 payment_status = paid
```

Money goes to the merchant's connected payOS/bank account. commerce-core does not hold merchant funds.

## Admin security

The Worker exposes a single-admin password flow:

1. browser sends password to `POST /api/v1/admin/session` over HTTPS
2. Worker compares it with `ADMIN_PASSWORD`
3. Worker returns an 8-hour HMAC-signed session token
4. Admin keeps the session token in `sessionStorage`
5. GitHub token and payment secrets never enter the browser

For a public production deployment, Cloudflare Access may additionally protect the Admin Portal and/or Worker admin routes.

## GitHub credentials

Use a fine-grained token limited to the storefront repository with Contents write permission.

Store it only with:

```bash
wrangler secret put GITHUB_TOKEN
```

Do not put it in `admin/config.js`, frontend code or committed configuration.

## Future replaceable boundaries

The v1 shapes intentionally allow later replacement:

```text
Git assets -> R2
password admin -> Cloudflare Access / account auth
flat shipping -> carrier adapters
single store -> tenant-aware deployment
static storefront -> AI-generated storefronts
```
