# Security

## Secrets

Never place these in Git, Admin Portal or storefront JavaScript:

- `GITHUB_TOKEN`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `PAYOS_CLIENT_ID`
- `PAYOS_API_KEY`
- `PAYOS_CHECKSUM_KEY`

Production secrets belong in Cloudflare Worker secrets.

## Admin session

v1 uses one admin password and a short-lived signed token.

This is intentionally simpler than a user/account system. It is appropriate for the initial service-led, one-store deployment but should not be stretched into a multi-tenant SaaS identity system.

Use HTTPS only. Cloudflare deployment provides HTTPS.

Cloudflare Access is recommended as an additional outer layer for a public Admin Portal.

## Checkout

The Worker:

- fetches the published catalog itself
- ignores client prices
- checks enabled payment and shipping methods
- snapshots product name and price into D1
- uses a random public token for public order lookup

## Payments

PayOS webhook data must verify successfully before it changes payment state.

Return URLs from the payment provider are only UI navigation. They are not proof of payment.

## GitHub

The GitHub token should be fine-grained and limited to the one repository that Admin Portal publishes.

GitHub operations run server-side.

## PII

D1 stores customer name, phone and delivery address because they are required for fulfillment.

Do not expose these fields through public order-status endpoints.

Define retention/deletion policy before onboarding real clients at meaningful scale.
