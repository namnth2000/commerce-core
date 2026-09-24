# Deployment

This is the shortest production setup for one store.

## 1. Deploy the storefront with Cloudflare Pages

Create a Pages project connected to this GitHub repository.

Use:

```text
Production branch: main
Build command: none
Build output directory: frontend
```

After deployment, note the production URL, for example:

```text
https://deskjoy.pages.dev
```

Cloudflare Pages automatically creates preview deployments for non-production branches. Branch aliases are used by Admin Portal after Save draft.

## 2. Create D1

From `backend/`:

```bash
npm install
npx wrangler d1 create commerce-core
```

Copy the returned database ID.

## 3. Configure Worker

```bash
cd backend
cp wrangler.toml.example wrangler.toml
cp .dev.vars.example .dev.vars
```

Edit `wrangler.toml`:

- `STOREFRONT_ORIGIN`: storefront origin
- `ADMIN_ORIGIN`: admin Pages origin
- `CATALOG_BASE_URL`: published storefront origin + `/data`
- `GITHUB_REPO`: repository used for Draft / Publish
- `GITHUB_MAIN_BRANCH`: normally `main`
- `PAGES_PROJECT_NAME`: storefront Pages project
- `PAYOS_RETURN_BASE_URL`: storefront URL
- D1 `database_id`

For local development, `CATALOG_BASE_URL` can remain:

```text
http://localhost:8000/frontend/data
```

Admin catalog browsing and checkout will then use the local JSON files without calling GitHub.

Do not commit `wrangler.toml` after inserting store-specific values. It is ignored under `backend/.gitignore`.

## 4. Local secrets

For basic local testing, only these are required:

```text
ADMIN_PASSWORD=...
SESSION_SECRET=...
```

Generate a long random `SESSION_SECRET`.

`GITHUB_TOKEN` is optional until you test:

- Save draft
- Preview
- Publish

When testing those actions, use a fine-grained GitHub token restricted to this repository with Contents read/write permission.

PayOS secrets are only required when `payos` is enabled in store config.

## 5. Apply D1 migration

Local:

```bash
npm run db:migrate:local
```

Production:

```bash
npm run db:migrate:remote
```

## 6. Run Worker locally

```bash
npm run dev
```

Default Wrangler dev URL is normally:

```text
http://localhost:8787
```

At this point, without a GitHub token, you can already test:

- `GET /health`
- Admin login
- Admin catalog loading
- Orders tab
- COD checkout
- bank-transfer checkout
- order status updates
- revenue summary

Draft / Preview / Publish will still require GitHub credentials.

## 7. Configure static apps

Edit:

```text
admin/config.js
frontend/config.js
```

Set each `apiBase` to the deployed Worker URL.

For local testing both default to `http://localhost:8787`.

## 8. Deploy Worker secrets

Before production:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GITHUB_TOKEN
```

If the store enables payOS:

```bash
npx wrangler secret put PAYOS_CLIENT_ID
npx wrangler secret put PAYOS_API_KEY
npx wrangler secret put PAYOS_CHECKSUM_KEY
```

Then deploy:

```bash
npm run deploy
```

## 9. Deploy Admin Portal

Create a second Cloudflare Pages project from the same repository.

Use:

```text
Production branch: main
Build command: none
Build output directory: admin
```

Set its origin in Worker `ADMIN_ORIGIN`.

For extra protection, put the Admin Pages domain behind Cloudflare Access.

## 10. Configure payOS webhook

Only if payOS is enabled.

Set the merchant's payOS webhook URL to:

```text
https://YOUR-WORKER/api/v1/webhooks/payos
```

The Worker verifies webhook data with `PAYOS_CHECKSUM_KEY` before marking an order paid.

## 11. First production check

Verify in this order:

1. `GET /health`
2. Admin login
3. Admin catalog load from `CATALOG_BASE_URL`
4. Save draft for a product
5. Open preview URL
6. Publish product
7. Place COD test order
8. Confirm it appears in Admin Orders
9. Update fulfillment status
10. If enabled, create a low-value payOS test payment and confirm webhook updates it to paid
